import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getEnrichedPortfolio } from "@/lib/portfolio";
import { Topbar } from "@/components/Topbar";
import { AllocationDonut } from "@/components/AllocationDonut";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function AllocationPage() {
  const user = (await requireUser())!;
  const portfolios = await prisma.portfolio.findMany({ where: { userId: user.id } });
  const summaries = await Promise.all(portfolios.map((p) => getEnrichedPortfolio(p.id)));

  // Aggregate across all portfolios.
  const byAsset = new Map<string, number>();
  const bySector = new Map<string, number>();
  let total = 0;
  for (const s of summaries) {
    if (!s) continue;
    total += s.totalValue;
    for (const a of s.allocationByAsset) byAsset.set(a.label, (byAsset.get(a.label) ?? 0) + a.value);
    for (const a of s.allocationBySector) bySector.set(a.label, (bySector.get(a.label) ?? 0) + a.value);
  }
  const toAlloc = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([label, value]) => ({ label, value, pct: total > 0 ? value / total : 0 }))
      .sort((a, b) => b.value - a.value);

  return (
    <>
      <Topbar title="Allocation" subtitle="Consolidated view across all portfolios" />
      <main className="flex-1 overflow-auto p-6">
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card-pad">
            <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">By asset class</h2>
            <AllocationDonut data={toAlloc(byAsset)} />
          </div>
          <div className="card-pad">
            <h2 className="text-sm font-medium text-fg-muted uppercase tracking-wide mb-4">By sector</h2>
            <AllocationDonut data={toAlloc(bySector)} />
          </div>
        </div>
        <div className="mt-6 card-pad">
          <div className="text-sm text-fg-muted">Total invested (market value)</div>
          <div className="text-2xl font-semibold">{formatCurrency(total, "USD")}</div>
        </div>
      </main>
    </>
  );
}
