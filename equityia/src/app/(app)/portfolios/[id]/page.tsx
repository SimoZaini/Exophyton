import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getEnrichedPortfolio, getPortfolioHistory } from "@/lib/portfolio";
import { Topbar } from "@/components/Topbar";
import { PerfChart } from "@/components/PerfChart";
import { AllocationDonut } from "@/components/AllocationDonut";
import { PositionsTable } from "@/components/PositionsTable";
import { AddPositionForm } from "@/components/AddPositionForm";
import { cn, formatCurrency, formatNumber, formatPercent, pnlColor } from "@/lib/utils";

export default async function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const user = (await requireUser())!;
  const portfolio = await prisma.portfolio.findFirst({ where: { id: params.id, userId: user.id } });
  if (!portfolio) notFound();
  const [summary, history] = await Promise.all([
    getEnrichedPortfolio(params.id),
    getPortfolioHistory(params.id, "1y"),
  ]);
  if (!summary) notFound();

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
      <Topbar title={summary.name} subtitle={`${summary.positions.length} positions · ${summary.baseCurrency}`} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="kpi">
              <span className="kpi-label">Total value</span>
              <span className="kpi-value">{formatCurrency(summary.totalValue, summary.baseCurrency)}</span>
              <span className={cn("text-sm tabular-nums", pnlColor(summary.dayChange))}>
                {formatPercent(summary.dayChangePct, 2)} today
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">P&amp;L</span>
              <span className={cn("kpi-value", pnlColor(summary.totalPnL))}>
                {formatCurrency(summary.totalPnL, summary.baseCurrency)}
              </span>
              <span className={cn("text-sm tabular-nums", pnlColor(summary.totalPnLPct))}>
                {formatPercent(summary.totalPnLPct, 2)}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Sharpe</span>
              <span className="kpi-value">
                {history ? formatNumber(history.risk.sharpe, 2) : "—"}
              </span>
              <span className="text-sm text-fg-muted">Risk-adjusted</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Max drawdown</span>
              <span className="kpi-value text-down">
                {history ? formatPercent(history.risk.maxDD, 2) : "—"}
              </span>
              <span className="text-sm text-fg-muted">1y window</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card-pad lg:col-span-2">
              <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">Performance vs. S&amp;P 500</h2>
              {chartData.length > 1 ? (
                <PerfChart data={chartData} currency={summary.baseCurrency} />
              ) : (
                <div className="h-72 grid place-items-center text-fg-muted text-sm">Not enough history.</div>
              )}
            </div>
            <div className="card-pad">
              <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">Allocation (assets)</h2>
              <AllocationDonut data={summary.allocationByAsset} currency={summary.baseCurrency} />
              <div className="h-px bg-bg-border my-4" />
              <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">Allocation (sectors)</h2>
              <AllocationDonut data={summary.allocationBySector} currency={summary.baseCurrency} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Holdings</h2>
              <AddPositionForm portfolioId={summary.id} />
            </div>
            <PositionsTable positions={summary.positions} currency={summary.baseCurrency} />
          </div>
        </div>
      </main>
    </>
  );
}
