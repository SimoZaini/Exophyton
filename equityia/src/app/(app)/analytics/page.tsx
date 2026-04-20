import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getPortfolioHistory } from "@/lib/portfolio";
import { Topbar } from "@/components/Topbar";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

export default async function AnalyticsPage() {
  const user = (await requireUser())!;
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const rows = await Promise.all(
    portfolios.map(async (p) => {
      const h = await getPortfolioHistory(p.id, "1y");
      return { portfolio: p, risk: h?.risk };
    })
  );

  return (
    <>
      <Topbar title="Risk & Analytics" subtitle="Aladdin-style metrics across all portfolios" />
      <main className="flex-1 overflow-auto p-6">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-elevated/40">
              <tr>
                <th className="th">Portfolio</th>
                <th className="th text-right">Ann. return</th>
                <th className="th text-right">Vol</th>
                <th className="th text-right">Sharpe</th>
                <th className="th text-right">Sortino</th>
                <th className="th text-right">Max DD</th>
                <th className="th text-right">VaR 95%</th>
                <th className="th text-right">CVaR 95%</th>
                <th className="th text-right">β (SPY)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ portfolio, risk }) => (
                <tr key={portfolio.id} className="hover:bg-bg-hover/40">
                  <td className="td font-medium">{portfolio.name}</td>
                  <td className={cn("td text-right tabular-nums", risk && risk.annualReturn >= 0 ? "text-up" : "text-down")}>
                    {risk ? formatPercent(risk.annualReturn, 2) : "—"}
                  </td>
                  <td className="td text-right tabular-nums">{risk ? formatPercent(risk.annualVol, 2) : "—"}</td>
                  <td className="td text-right tabular-nums">{risk ? formatNumber(risk.sharpe, 2) : "—"}</td>
                  <td className="td text-right tabular-nums">{risk ? formatNumber(risk.sortino, 2) : "—"}</td>
                  <td className="td text-right tabular-nums text-down">{risk ? formatPercent(risk.maxDD, 2) : "—"}</td>
                  <td className="td text-right tabular-nums text-down">{risk ? formatPercent(risk.var95, 2) : "—"}</td>
                  <td className="td text-right tabular-nums text-down">{risk ? formatPercent(risk.cvar95, 2) : "—"}</td>
                  <td className="td text-right tabular-nums">{risk?.beta != null ? formatNumber(risk.beta, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 card-pad">
          <h3 className="font-semibold mb-2">Metric definitions</h3>
          <ul className="text-sm text-fg-muted space-y-1.5">
            <li><strong className="text-fg">Sharpe:</strong> excess return per unit of total volatility (rf = 4%).</li>
            <li><strong className="text-fg">Sortino:</strong> like Sharpe but penalizes only downside volatility.</li>
            <li><strong className="text-fg">Max drawdown:</strong> worst peak-to-trough loss on the window.</li>
            <li><strong className="text-fg">VaR 95%:</strong> historical one-day loss exceeded with 5% probability.</li>
            <li><strong className="text-fg">CVaR 95%:</strong> expected loss in the worst 5% of days.</li>
            <li><strong className="text-fg">β (SPY):</strong> sensitivity to S&amp;P 500 daily returns.</li>
          </ul>
        </div>
      </main>
    </>
  );
}
