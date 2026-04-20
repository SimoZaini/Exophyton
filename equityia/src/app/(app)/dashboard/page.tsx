import Link from "next/link";
import { ArrowUpRight, Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getEnrichedPortfolio, getPortfolioHistory } from "@/lib/portfolio";
import { Topbar } from "@/components/Topbar";
import { PerfChart } from "@/components/PerfChart";
import { AllocationDonut } from "@/components/AllocationDonut";
import { PositionsTable } from "@/components/PositionsTable";
import { AddPositionForm } from "@/components/AddPositionForm";
import { cn, formatCurrency, formatNumber, formatPercent, pnlColor } from "@/lib/utils";

export default async function DashboardPage() {
  const user = (await requireUser())!;

  // Aggregate across all portfolios.
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (portfolios.length === 0) {
    return (
      <>
        <Topbar title="Dashboard" subtitle="Welcome to EquityIA" />
        <div className="p-6">
          <div className="card-pad text-center py-16">
            <h2 className="text-lg font-semibold">Create your first portfolio</h2>
            <p className="text-fg-muted mt-1">Organize your holdings by account or strategy.</p>
            <Link href="/portfolios" className="btn-primary mt-4 inline-flex">
              Create portfolio
            </Link>
          </div>
        </div>
      </>
    );
  }

  const primary = portfolios[0];
  const [summary, history] = await Promise.all([
    getEnrichedPortfolio(primary.id),
    getPortfolioHistory(primary.id, "1y"),
  ]);
  if (!summary) return null;

  const chartData =
    history?.series.map((p, i) => ({
      date: p.date.toISOString().slice(0, 10),
      value: p.value,
      benchmark:
        history.benchmark?.[i] && history.benchmark[0]
          ? (history.benchmark[i].value / history.benchmark[0].value) * (history.series[0]?.value ?? 0)
          : undefined,
    })) ?? [];

  return (
    <>
      <Topbar title="Dashboard" subtitle={`${primary.name} · ${summary.positions.length} positions`} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="kpi">
              <span className="kpi-label">Total value</span>
              <span className="kpi-value">{formatCurrency(summary.totalValue, summary.baseCurrency)}</span>
              <span className={cn("text-sm tabular-nums", pnlColor(summary.dayChange))}>
                {formatCurrency(summary.dayChange, summary.baseCurrency)} ({formatPercent(summary.dayChangePct, 2)}) today
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Total P&amp;L</span>
              <span className={cn("kpi-value", pnlColor(summary.totalPnL))}>
                {formatCurrency(summary.totalPnL, summary.baseCurrency)}
              </span>
              <span className={cn("text-sm tabular-nums", pnlColor(summary.totalPnLPct))}>
                {formatPercent(summary.totalPnLPct, 2)} all-time
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Cost basis</span>
              <span className="kpi-value">{formatCurrency(summary.totalCost, summary.baseCurrency)}</span>
              <span className="text-sm text-fg-muted">Invested capital</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Positions</span>
              <span className="kpi-value">{summary.positions.length}</span>
              <span className="text-sm text-fg-muted">
                {summary.allocationByAsset.length} asset {summary.allocationByAsset.length === 1 ? "class" : "classes"}
              </span>
            </div>
          </div>

          {/* Perf + risk */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card-pad lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide">Performance</h2>
                  <p className="text-lg font-semibold">Last 12 months vs. S&amp;P 500</p>
                </div>
                <Link
                  href={`/portfolios/${primary.id}`}
                  className="text-xs text-brand-400 hover:text-brand-300 inline-flex items-center gap-1"
                >
                  Open portfolio <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {chartData.length > 1 ? (
                <PerfChart data={chartData} currency={summary.baseCurrency} />
              ) : (
                <div className="h-72 grid place-items-center text-fg-muted text-sm">
                  Not enough history yet.
                </div>
              )}
            </div>

            <div className="card-pad">
              <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">Risk metrics</h2>
              {history && history.series.length > 1 ? (
                <dl className="space-y-3 text-sm">
                  <RiskRow label="Annualized return" value={formatPercent(history.risk.annualReturn, 2)} pos={history.risk.annualReturn >= 0} />
                  <RiskRow label="Volatility (annual)" value={formatPercent(history.risk.annualVol, 2)} />
                  <RiskRow label="Sharpe ratio" value={formatNumber(history.risk.sharpe, 2)} pos={history.risk.sharpe >= 1} />
                  <RiskRow label="Sortino ratio" value={formatNumber(history.risk.sortino, 2)} pos={history.risk.sortino >= 1} />
                  <RiskRow label="Max drawdown" value={formatPercent(history.risk.maxDD, 2)} pos={false} />
                  <RiskRow label="VaR 95% (daily)" value={formatPercent(history.risk.var95, 2)} pos={false} />
                  <RiskRow label="CVaR 95%" value={formatPercent(history.risk.cvar95, 2)} pos={false} />
                  <RiskRow label="Beta (vs SPY)" value={formatNumber(history.risk.beta ?? 0, 2)} />
                </dl>
              ) : (
                <p className="text-sm text-fg-muted">Need more history to compute metrics.</p>
              )}
            </div>
          </div>

          {/* Allocation + positions */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card-pad">
              <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">By asset class</h2>
              <AllocationDonut data={summary.allocationByAsset} currency={summary.baseCurrency} />
            </div>
            <div className="card-pad">
              <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">By sector</h2>
              <AllocationDonut data={summary.allocationBySector} currency={summary.baseCurrency} />
            </div>
            <div className="card-pad">
              <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">Portfolios</h2>
              <ul className="space-y-2">
                {portfolios.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/portfolios/${p.id}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-bg-hover transition-colors"
                    >
                      <div className="h-9 w-9 rounded-lg bg-brand-600/15 text-brand-300 grid place-items-center">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-fg-muted">{p.baseCurrency}</div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-fg-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Positions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Holdings</h2>
                <p className="text-sm text-fg-muted">{summary.positions.length} positions in {primary.name}</p>
              </div>
              <AddPositionForm portfolioId={primary.id} />
            </div>
            <PositionsTable positions={summary.positions} currency={summary.baseCurrency} />
          </div>
        </div>
      </main>
    </>
  );
}

function RiskRow({ label, value, pos }: { label: string; value: string; pos?: boolean }) {
  const color = pos === true ? "text-up" : pos === false ? "text-down" : "text-fg";
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={cn("tabular-nums font-medium", color)}>{value}</dd>
    </div>
  );
}
