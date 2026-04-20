import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getEnrichedPortfolio, type Breakdown } from "@/lib/portfolio";
import { computeDiversification } from "@/lib/diversification";
import { Topbar } from "@/components/Topbar";
import { AllocationDonut } from "@/components/AllocationDonut";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Globe2, PieChart } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DiversificationPage() {
  const user = (await requireUser())!;
  const portfolios = await prisma.portfolio.findMany({ where: { userId: user.id } });
  const summaries = (await Promise.all(portfolios.map((p) => getEnrichedPortfolio(p.id)))).filter(
    (s): s is NonNullable<typeof s> => s !== null
  );

  // Merge breakdowns & positions across portfolios.
  const merge = (key: keyof Pick<typeof summaries[number],
    "allocationByAsset" | "allocationBySector" | "allocationByIndustry" | "allocationByCountry" | "allocationByRegion">): Breakdown => {
    const m = new Map<string, number>();
    let total = 0;
    for (const s of summaries) {
      for (const b of s[key]) {
        m.set(b.label, (m.get(b.label) ?? 0) + b.value);
        total += b.value;
      }
    }
    // Correct the total — total is now summed across all allocations (each position counted once per breakdown).
    total = Array.from(m.values()).reduce((a, b) => a + b, 0);
    return Array.from(m.entries())
      .map(([label, value]) => ({ label, value, pct: total > 0 ? value / total : 0 }))
      .sort((a, b) => b.value - a.value);
  };

  const allPositions = summaries.flatMap((s) => s.positions);
  const totalValue = allPositions.reduce((a, p) => a + p.marketValue, 0);
  // Recompute per-position weight vs. merged total.
  const mergedPositions = allPositions.map((p) => ({
    ...p,
    weight: totalValue > 0 ? p.marketValue / totalValue : 0,
  }));

  const byAsset = merge("allocationByAsset");
  const bySector = merge("allocationBySector");
  const byIndustry = merge("allocationByIndustry");
  const byCountry = merge("allocationByCountry");
  const byRegion = merge("allocationByRegion");

  const metrics = computeDiversification(mergedPositions, bySector, byCountry);

  const topPositions = [...mergedPositions].sort((a, b) => b.weight - a.weight).slice(0, 10);

  const concentrationAlerts: { level: "warn" | "danger"; message: string }[] = [];
  if (metrics.largestSector && metrics.largestSector.weight > 0.4)
    concentrationAlerts.push({
      level: "danger",
      message: `Heavy sector concentration in ${metrics.largestSector.label} (${formatPercent(metrics.largestSector.weight, 1)})`,
    });
  else if (metrics.largestSector && metrics.largestSector.weight > 0.3)
    concentrationAlerts.push({
      level: "warn",
      message: `Sector skew toward ${metrics.largestSector.label} (${formatPercent(metrics.largestSector.weight, 1)})`,
    });
  if (metrics.largestCountry && metrics.largestCountry.weight > 0.7)
    concentrationAlerts.push({
      level: "warn",
      message: `Geographic concentration: ${formatPercent(metrics.largestCountry.weight, 1)} in ${metrics.largestCountry.label}`,
    });
  if (metrics.top5Weight > 0.6)
    concentrationAlerts.push({
      level: "warn",
      message: `Top 5 holdings weigh ${formatPercent(metrics.top5Weight, 1)} of the book`,
    });

  return (
    <>
      <Topbar title="Diversification" subtitle="Sector, industry & geographic exposure" />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="kpi">
              <span className="kpi-label">Effective holdings</span>
              <span className="kpi-value">{formatNumber(metrics.positionsEffectiveN, 1)}</span>
              <span className="text-sm text-fg-muted">of {mergedPositions.length} positions</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Top 5 weight</span>
              <span className={cn("kpi-value", metrics.top5Weight > 0.5 ? "text-warn" : "text-fg")}>
                {formatPercent(metrics.top5Weight, 1)}
              </span>
              <span className="text-sm text-fg-muted">Top 10: {formatPercent(metrics.top10Weight, 1)}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Concentration score</span>
              <span
                className={cn(
                  "kpi-value",
                  metrics.concentrationScore > 50 ? "text-down" : metrics.concentrationScore > 25 ? "text-warn" : "text-up"
                )}
              >
                {formatNumber(metrics.concentrationScore, 0)}/100
              </span>
              <span className="text-sm text-fg-muted">0 = equal-weighted</span>
            </div>
            <div className="kpi">
              <span className="kpi-label"><Globe2 className="inline h-3 w-3 mr-1" />Countries</span>
              <span className="kpi-value">{byCountry.filter((c) => c.label !== "Unclassified").length}</span>
              <span className="text-sm text-fg-muted">
                {byRegion.filter((r) => r.label !== "Unclassified").length} regions
              </span>
            </div>
          </div>

          {concentrationAlerts.length > 0 && (
            <div className="space-y-2">
              {concentrationAlerts.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    "card-pad flex items-start gap-3 text-sm py-3",
                    a.level === "danger" ? "border-down/40" : "border-warn/40"
                  )}
                >
                  <AlertTriangle
                    className={cn("h-4 w-4 mt-0.5 shrink-0", a.level === "danger" ? "text-down" : "text-warn")}
                  />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}
          {concentrationAlerts.length === 0 && summaries.length > 0 && (
            <div className="card-pad flex items-start gap-3 text-sm py-3 border-up/30">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-up shrink-0" />
              <span>No major concentration risks detected.</span>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <BreakdownCard title="By sector" data={bySector} icon={<PieChart className="h-4 w-4" />} />
            <BreakdownCard title="By industry" data={byIndustry} />
            <BreakdownCard title="By country" data={byCountry} />
            <BreakdownCard title="By region" data={byRegion} />
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-bg-border flex items-center justify-between">
              <h3 className="text-sm font-medium text-fg-muted uppercase tracking-wide">Top 10 holdings</h3>
              <span className="text-xs text-fg-subtle">Sales segmentation — each share weighted by market value</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg-elevated/40">
                  <tr>
                    <th className="th">#</th>
                    <th className="th">Symbol</th>
                    <th className="th">Sector</th>
                    <th className="th">Industry</th>
                    <th className="th">Country</th>
                    <th className="th text-right">Market value</th>
                    <th className="th text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {topPositions.map((p, i) => (
                    <tr key={p.id} className="hover:bg-bg-hover/40">
                      <td className="td text-fg-muted">{i + 1}</td>
                      <td className="td">
                        <div className="font-medium">{p.symbol}</div>
                        <div className="text-xs text-fg-muted truncate max-w-[220px]">{p.name}</div>
                      </td>
                      <td className="td text-fg-muted">{p.sector ?? "—"}</td>
                      <td className="td text-fg-muted">{p.industry ?? "—"}</td>
                      <td className="td text-fg-muted">{p.country ?? "—"}</td>
                      <td className="td text-right tabular-nums">{formatCurrency(p.marketValue)}</td>
                      <td className="td text-right tabular-nums font-medium">{formatPercent(p.weight, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-pad text-xs text-fg-subtle">
            Classification uses Yahoo Finance metadata (sector, industry, HQ country). Geographic
            exposure reflects the company's country of domicile, not where its revenue is generated.
          </div>
        </div>
      </main>
    </>
  );
}

function BreakdownCard({
  title,
  data,
  icon,
}: {
  title: string;
  data: Breakdown;
  icon?: React.ReactNode;
}) {
  return (
    <div className="card-pad">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide">{title}</h2>
      </div>
      {data.length > 0 ? (
        <>
          <AllocationDonut data={data} />
          <div className="mt-4 space-y-1.5 text-xs">
            {data.slice(0, 8).map((d) => (
              <div key={d.label} className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-bg-hover overflow-hidden">
                  <div
                    className="h-full bg-brand-500"
                    style={{ width: `${Math.min(100, d.pct * 100)}%` }}
                  />
                </div>
                <span className="tabular-nums text-fg-muted w-12 text-right">{formatPercent(d.pct, 1)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-40 grid place-items-center text-fg-muted text-sm">No data</div>
      )}
    </div>
  );
}
