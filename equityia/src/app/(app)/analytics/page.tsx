import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getEnrichedPortfolio, getPortfolioHistory } from "@/lib/portfolio";
import { cachedHistorical } from "@/lib/market";
import { alignedReturnsMatrix } from "@/lib/analytics";
import { runFactorRegression } from "@/lib/factors";
import { runAllStressTests } from "@/lib/stress";
import { runMonteCarlo } from "@/lib/montecarlo";
import { runOptimizer } from "@/lib/optimizer";
import { Topbar } from "@/components/Topbar";
import { StressChart } from "@/components/StressChart";
import { VaRHistogram } from "@/components/VaRHistogram";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { AlertTriangle, Sparkles, Target } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const user = (await requireUser())!;
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  if (portfolios.length === 0) {
    return (
      <>
        <Topbar title="Risk & Analytics" subtitle="Aladdin-style metrics" />
        <div className="p-6">
          <div className="card-pad text-center py-16 text-fg-muted">No portfolios yet.</div>
        </div>
      </>
    );
  }

  const primary = portfolios[0];
  const [summary, history] = await Promise.all([
    getEnrichedPortfolio(primary.id),
    getPortfolioHistory(primary.id, "2y"),
  ]);
  if (!summary) return null;

  // Fetch 2-year daily price series for each holding, in parallel.
  const perSymbolSeries: Record<string, { date: Date; close: number }[]> = {};
  await Promise.all(
    summary.positions.map(async (p) => {
      perSymbolSeries[p.symbol] = (await cachedHistorical(p.symbol, "2y")).map((h) => ({
        date: h.date,
        close: h.close,
      }));
    })
  );
  const symbols = summary.positions.map((p) => p.symbol);
  const weights = summary.positions.map((p) => p.weight);
  const { matrix: returnsMatrix } = alignedReturnsMatrix(symbols, perSymbolSeries);

  const [factorReg, stressResults, mcResult, opt] = await Promise.all([
    history?.series ? runFactorRegression(history.series, "2y") : Promise.resolve(null),
    runAllStressTests(
      summary.positions.map((p) => ({
        symbol: p.symbol,
        weight: p.weight,
        assetType: p.assetType,
        sector: p.sector,
      })),
      summary.totalValue
    ),
    Promise.resolve(
      runMonteCarlo({
        symbols,
        weights,
        returnsMatrix,
        portfolioValue: summary.totalValue,
        horizonDays: 21,
        simulations: 10_000,
      })
    ),
    Promise.resolve(
      runOptimizer(
        { symbols, currentWeights: weights, returnsMatrix },
        summary.totalValue
      )
    ),
  ]);

  // Side summary of all portfolios (kept from v1).
  const allRisk = await Promise.all(
    portfolios.map(async (p) => {
      const h = await getPortfolioHistory(p.id, "1y");
      return { portfolio: p, risk: h?.risk };
    })
  );

  return (
    <>
      <Topbar
        title="Risk & Analytics"
        subtitle={`${primary.name} · factor model, stress, MC VaR, optimizer`}
      />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* FACTOR MODEL */}
          <section className="card-pad">
            <SectionHeader
              icon={<Sparkles className="h-4 w-4" />}
              title="Factor exposures (Fama-French 3)"
              subtitle="Portfolio daily excess returns regressed on market / size / value, 2 years."
            />
            {factorReg ? (
              <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-fg-muted uppercase tracking-wide">
                      <tr>
                        <th className="text-left py-2">Factor</th>
                        <th className="text-right py-2">Loading</th>
                        <th className="text-right py-2">t-stat</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-bg-border">
                        <td className="py-2">Alpha (annualized)</td>
                        <td className={cn("text-right tabular-nums font-medium", factorReg.alphaAnnualized >= 0 ? "text-up" : "text-down")}>
                          {formatPercent(factorReg.alphaAnnualized, 2)}
                        </td>
                        <td className="text-right tabular-nums text-fg-muted">
                          {formatNumber(factorReg.tStats.alpha, 2)}
                        </td>
                      </tr>
                      {factorReg.factors.map((f) => (
                        <tr key={f} className="border-t border-bg-border">
                          <td className="py-2">{factorLabel(f)}</td>
                          <td className={cn("text-right tabular-nums font-medium", Math.abs(factorReg.betas[f]) > 0.5 ? "text-fg" : "text-fg-muted")}>
                            {formatNumber(factorReg.betas[f], 2)}
                          </td>
                          <td className="text-right tabular-nums text-fg-muted">
                            {formatNumber(factorReg.tStats[f], 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3">
                  <Metric label="R²" value={formatPercent(factorReg.rSquared, 1)} />
                  <Metric label="Adjusted R²" value={formatPercent(factorReg.adjRSquared, 1)} />
                  <Metric
                    label="Idiosyncratic vol (annualized)"
                    value={formatPercent(factorReg.residualVolAnn, 2)}
                    hint="Portfolio volatility not explained by the 3 factors."
                  />
                  <Metric label="Observations" value={String(factorReg.n)} hint="Daily data points aligned with factor set." />
                </div>
              </div>
            ) : (
              <EmptyState reason="Need ≥30 overlapping days of portfolio + ETF proxy data (SPY, IWM, IWD, IWF)." />
            )}
          </section>

          {/* STRESS TESTS */}
          <section className="card-pad">
            <SectionHeader
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Historical stress tests"
              subtitle="Replay of past macro shocks on current weights. Proxied tickers use SPY / AGG / GLD where history is missing."
            />
            {stressResults.some((r) => r.contributors.length > 0) ? (
              <>
                <StressChart
                  data={stressResults.map((r) => ({
                    name: r.scenario.name,
                    returnPct: r.portfolioReturn,
                    pnl: r.portfolioValueChange,
                  }))}
                  currency={summary.baseCurrency}
                />
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                  {stressResults.map((r) => (
                    <div key={r.scenario.key} className="rounded-lg border border-bg-border p-3">
                      <div className="text-xs text-fg-muted">{r.scenario.name}</div>
                      <div className={cn("text-xl font-semibold tabular-nums", r.portfolioReturn >= 0 ? "text-up" : "text-down")}>
                        {formatPercent(r.portfolioReturn, 1)}
                      </div>
                      <div className={cn("text-xs tabular-nums", r.portfolioReturn >= 0 ? "text-up" : "text-down")}>
                        {formatCurrency(r.portfolioValueChange, summary.baseCurrency, true)}
                      </div>
                      <div className="text-[10px] text-fg-subtle mt-1">
                        {r.contributors.filter((c) => c.proxied).length} proxied ·
                        {" "}
                        {r.scenario.from.toISOString().slice(0, 7)} → {r.scenario.to.toISOString().slice(0, 7)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState reason="No historical data cached for these windows. Seed first (live yahoo access required) or wait until the cache is populated." />
            )}
          </section>

          {/* MONTE CARLO VaR */}
          <section className="card-pad">
            <SectionHeader
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Monte Carlo VaR — 1-month horizon"
              subtitle={`${mcResult?.simulations.toLocaleString() ?? "—"} simulations · multivariate-normal draws from the 2-year covariance matrix.`}
            />
            {mcResult ? (
              <div className="grid lg:grid-cols-3 gap-6 mt-4">
                <div className="lg:col-span-2">
                  <VaRHistogram
                    data={mcResult.histogram}
                    var95Return={-mcResult.var95 / summary.totalValue}
                    var99Return={-mcResult.var99 / summary.totalValue}
                  />
                </div>
                <div className="space-y-3 text-sm">
                  <Metric label="Expected 1-month P&L" value={formatCurrency(mcResult.expectedPnL, summary.baseCurrency)} tone={mcResult.expectedPnL >= 0 ? "up" : "down"} />
                  <Metric label="VaR 95%" value={formatCurrency(mcResult.var95, summary.baseCurrency)} tone="down" hint="Loss exceeded in 5% of simulations." />
                  <Metric label="VaR 99%" value={formatCurrency(mcResult.var99, summary.baseCurrency)} tone="down" hint="Loss exceeded in 1% of simulations." />
                  <Metric label="CVaR 95%" value={formatCurrency(mcResult.cvar95, summary.baseCurrency)} tone="down" hint="Mean loss in the worst 5%." />
                  <Metric label="Best 1% case" value={formatPercent(mcResult.bestCase, 1)} tone="up" />
                  <Metric label="Worst 1% case" value={formatPercent(mcResult.worstCase, 1)} tone="down" />
                </div>
              </div>
            ) : (
              <EmptyState reason="Need ≥30 days of common history across every holding." />
            )}
          </section>

          {/* OPTIMIZER */}
          <section className="card-pad">
            <SectionHeader
              icon={<Target className="h-4 w-4" />}
              title="Markowitz optimizer"
              subtitle="Long-only, fully-invested. Expected μ and Σ annualized from 2y daily returns."
            />
            {opt ? (
              <>
                <div className="grid md:grid-cols-3 gap-4 mt-4">
                  <OptimizerSummary
                    label="Current"
                    exp={opt.currentStats.expectedReturn}
                    vol={opt.currentStats.expectedVol}
                    sharpe={opt.currentStats.sharpe}
                    active
                  />
                  <OptimizerSummary
                    label="Min variance"
                    exp={opt.minVariance.expectedReturn}
                    vol={opt.minVariance.expectedVol}
                    sharpe={opt.minVariance.sharpe}
                  />
                  <OptimizerSummary
                    label="Max Sharpe"
                    exp={opt.maxSharpe.expectedReturn}
                    vol={opt.maxSharpe.expectedVol}
                    sharpe={opt.maxSharpe.sharpe}
                  />
                </div>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-fg-muted uppercase tracking-wide">
                      <tr>
                        <th className="text-left py-2">Symbol</th>
                        <th className="text-right py-2">Current</th>
                        <th className="text-right py-2">Min var.</th>
                        <th className="text-right py-2">Δ (min var.)</th>
                        <th className="text-right py-2">Trade</th>
                        <th className="text-right py-2">Max Sharpe</th>
                        <th className="text-right py-2">Δ (max S.)</th>
                        <th className="text-right py-2">Trade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opt.symbols.map((sym, i) => {
                        const curW = weights[i];
                        const mvW = opt.minVariance.weights[i];
                        const msW = opt.maxSharpe.weights[i];
                        const mvDelta = mvW - curW;
                        const msDelta = msW - curW;
                        const mvTrade = opt.minVariance.trades[i].tradeUsd;
                        const msTrade = opt.maxSharpe.trades[i].tradeUsd;
                        return (
                          <tr key={sym} className="border-t border-bg-border">
                            <td className="py-2 font-medium">{sym}</td>
                            <td className="text-right tabular-nums text-fg-muted">{formatPercent(curW, 1)}</td>
                            <td className="text-right tabular-nums">{formatPercent(mvW, 1)}</td>
                            <td className={cn("text-right tabular-nums", mvDelta > 0.005 ? "text-up" : mvDelta < -0.005 ? "text-down" : "text-fg-muted")}>
                              {formatPercent(mvDelta, 1)}
                            </td>
                            <td className={cn("text-right tabular-nums", mvTrade > 0 ? "text-up" : mvTrade < 0 ? "text-down" : "text-fg-muted")}>
                              {Math.abs(mvTrade) < 1 ? "—" : formatCurrency(mvTrade, summary.baseCurrency, true)}
                            </td>
                            <td className="text-right tabular-nums">{formatPercent(msW, 1)}</td>
                            <td className={cn("text-right tabular-nums", msDelta > 0.005 ? "text-up" : msDelta < -0.005 ? "text-down" : "text-fg-muted")}>
                              {formatPercent(msDelta, 1)}
                            </td>
                            <td className={cn("text-right tabular-nums", msTrade > 0 ? "text-up" : msTrade < 0 ? "text-down" : "text-fg-muted")}>
                              {Math.abs(msTrade) < 1 ? "—" : formatCurrency(msTrade, summary.baseCurrency, true)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-fg-subtle mt-3">
                  Expected returns extrapolated from historical means — notoriously noisy. Treat max-Sharpe weights as a direction, not a prescription.
                </p>
              </>
            ) : (
              <EmptyState reason="Not enough overlapping daily returns across holdings to compute covariance." />
            )}
          </section>

          {/* ALL-PORTFOLIOS RISK TABLE (kept from v1) */}
          <section className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-bg-border">
              <h3 className="text-sm font-medium text-fg-muted uppercase tracking-wide">
                Risk summary — all portfolios
              </h3>
            </div>
            <div className="overflow-x-auto">
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
                  {allRisk.map(({ portfolio, risk }) => (
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
          </section>
        </div>
      </main>
    </>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-brand-600/15 text-brand-300 grid place-items-center shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-fg-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs text-fg-muted uppercase tracking-wide">{label}</div>
        {hint && <div className="text-[11px] text-fg-subtle mt-0.5">{hint}</div>}
      </div>
      <div className={cn("text-sm tabular-nums font-medium", tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-fg")}>
        {value}
      </div>
    </div>
  );
}

function OptimizerSummary({
  label,
  exp,
  vol,
  sharpe,
  active,
}: {
  label: string;
  exp: number;
  vol: number;
  sharpe: number;
  active?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border p-4", active ? "border-brand-600/50 bg-brand-600/5" : "border-bg-border")}>
      <div className="text-xs uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="mt-2 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-fg-muted">Exp. return</span><span className={cn("tabular-nums font-medium", exp >= 0 ? "text-up" : "text-down")}>{formatPercent(exp, 2)}</span></div>
        <div className="flex justify-between"><span className="text-fg-muted">Volatility</span><span className="tabular-nums">{formatPercent(vol, 2)}</span></div>
        <div className="flex justify-between"><span className="text-fg-muted">Sharpe</span><span className={cn("tabular-nums font-medium", sharpe >= 1 ? "text-up" : "text-fg")}>{formatNumber(sharpe, 2)}</span></div>
      </div>
    </div>
  );
}

function EmptyState({ reason }: { reason: string }) {
  return (
    <div className="mt-4 rounded-lg border border-bg-border/50 bg-bg-elevated/20 p-4 text-sm text-fg-muted">
      {reason}
    </div>
  );
}

function factorLabel(f: string): string {
  return { MKT: "MKT — Market (SPY − rf)", SMB: "SMB — Small minus Big (IWM − SPY)", HML: "HML — Value minus Growth (IWD − IWF)", QMJ: "QMJ — Quality (QUAL − SPY)" }[f] ?? f;
}
