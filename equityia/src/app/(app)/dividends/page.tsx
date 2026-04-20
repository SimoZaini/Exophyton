import { requireUser } from "@/lib/session";
import { aggregateDividendSummaryForUser } from "@/lib/dividends";
import { Topbar } from "@/components/Topbar";
import { DividendChart } from "@/components/DividendChart";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { CalendarDays, Coins, PiggyBank, Repeat } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DividendsPage() {
  const user = (await requireUser())!;
  const summary = await aggregateDividendSummaryForUser(user.id);

  const dividendPayers = summary.positions
    .filter((p) => p.dividendRate > 0)
    .sort((a, b) => b.forwardAnnualIncome - a.forwardAnnualIncome);

  const avgMonthly = summary.projectedMonthly.reduce((a, b) => a + b.amount, 0) / 12;

  return (
    <>
      <Topbar title="Dividends" subtitle="Forward income projection & calendar" />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="kpi">
              <span className="kpi-label"><Coins className="inline h-3 w-3 mr-1" />Forward annual income</span>
              <span className="kpi-value text-up">{formatCurrency(summary.forwardAnnualIncome)}</span>
              <span className="text-sm text-fg-muted">{formatCurrency(avgMonthly)} / month avg.</span>
            </div>
            <div className="kpi">
              <span className="kpi-label"><PiggyBank className="inline h-3 w-3 mr-1" />Portfolio yield</span>
              <span className="kpi-value">{formatPercent(summary.portfolioYield, 2)}</span>
              <span className="text-sm text-fg-muted">on market value</span>
            </div>
            <div className="kpi">
              <span className="kpi-label"><Repeat className="inline h-3 w-3 mr-1" />Yield on cost</span>
              <span className="kpi-value">{formatPercent(summary.weightedYieldOnCost, 2)}</span>
              <span className="text-sm text-fg-muted">weighted average</span>
            </div>
            <div className="kpi">
              <span className="kpi-label"><CalendarDays className="inline h-3 w-3 mr-1" />Payers</span>
              <span className="kpi-value">{dividendPayers.length}</span>
              <span className="text-sm text-fg-muted">out of {summary.positions.length} holdings</span>
            </div>
          </div>

          <div className="card-pad">
            <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">
              Projected monthly income (next 12 months)
            </h2>
            {summary.projectedMonthly.some((m) => m.amount > 0) ? (
              <DividendChart data={summary.projectedMonthly} />
            ) : (
              <div className="h-64 grid place-items-center text-fg-muted text-sm">
                No projected dividends — none of your holdings declare a forward dividend.
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-border">
                <h3 className="text-sm font-medium text-fg-muted uppercase tracking-wide">Dividend payers</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-bg-elevated/40">
                    <tr>
                      <th className="th">Symbol</th>
                      <th className="th text-right">Yield</th>
                      <th className="th text-right">YoC</th>
                      <th className="th text-right">Freq.</th>
                      <th className="th text-right">Annual income</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dividendPayers.length === 0 && (
                      <tr>
                        <td className="td text-fg-muted" colSpan={5}>No dividend payers yet.</td>
                      </tr>
                    )}
                    {dividendPayers.map((p) => (
                      <tr key={p.symbol} className="hover:bg-bg-hover/40">
                        <td className="td">
                          <div className="font-medium">{p.symbol}</div>
                          <div className="text-xs text-fg-muted truncate max-w-[220px]">{p.name}</div>
                        </td>
                        <td className="td text-right tabular-nums">{formatPercent(p.dividendYield, 2)}</td>
                        <td className={cn("td text-right tabular-nums", p.yieldOnCost > p.dividendYield ? "text-up" : "text-fg")}>
                          {formatPercent(p.yieldOnCost, 2)}
                        </td>
                        <td className="td text-right text-fg-muted">{freqLabel(p.payoutFrequency)}</td>
                        <td className="td text-right tabular-nums font-medium text-up">
                          {formatCurrency(p.forwardAnnualIncome)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-bg-border">
                <h3 className="text-sm font-medium text-fg-muted uppercase tracking-wide">Upcoming payments (projected)</h3>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full">
                  <thead className="bg-bg-elevated/40 sticky top-0">
                    <tr>
                      <th className="th">Date</th>
                      <th className="th">Symbol</th>
                      <th className="th text-right">Per share</th>
                      <th className="th text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.upcoming.length === 0 && (
                      <tr>
                        <td className="td text-fg-muted" colSpan={4}>No upcoming dividends projected.</td>
                      </tr>
                    )}
                    {summary.upcoming.slice(0, 20).map((d, i) => (
                      <tr key={`${d.symbol}-${i}`} className="hover:bg-bg-hover/40">
                        <td className="td tabular-nums">
                          {d.date.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}
                        </td>
                        <td className="td font-medium">{d.symbol}</td>
                        <td className="td text-right tabular-nums text-fg-muted">
                          {formatCurrency(d.amountPerShare)}
                        </td>
                        <td className="td text-right tabular-nums font-medium text-up">
                          {formatCurrency(d.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card-pad text-xs text-fg-subtle">
            Projection methodology: forward annual dividend (yahoo-finance2) × position quantity,
            distributed across inferred payment frequency starting from the next known ex-dividend date.
            No growth assumption. Actual payments may differ.
          </div>
        </div>
      </main>
    </>
  );
}

function freqLabel(f: number): string {
  switch (f) {
    case 12: return "Monthly";
    case 4: return "Quarterly";
    case 2: return "Semi-annual";
    case 1: return "Annual";
    default: return `${f}/yr`;
  }
}
