import Link from "next/link";
import { ArrowUpRight, Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Topbar } from "@/components/Topbar";
import { NewPortfolioForm } from "@/components/NewPortfolioForm";

export default async function PortfoliosPage() {
  const user = (await requireUser())!;
  const portfolios = await prisma.portfolio.findMany({
    where: { userId: user.id },
    include: { _count: { select: { positions: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <Topbar title="Portfolios" subtitle="Organize holdings by account or strategy" />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex justify-end">
            <NewPortfolioForm />
          </div>
          {portfolios.length === 0 ? (
            <div className="card-pad text-center py-16">
              <p className="text-fg-muted">No portfolios yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {portfolios.map((p) => (
                <Link
                  key={p.id}
                  href={`/portfolios/${p.id}`}
                  className="card-pad hover:bg-bg-hover/40 transition-colors flex items-start gap-4"
                >
                  <div className="h-10 w-10 rounded-lg bg-brand-600/15 text-brand-300 grid place-items-center">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-sm text-fg-muted">
                      {p._count.positions} positions · {p.baseCurrency}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-fg-subtle" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
