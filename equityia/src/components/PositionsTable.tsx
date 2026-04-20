"use client";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EnrichedPosition } from "@/lib/portfolio";
import { cn, formatCurrency, formatNumber, formatPercent, pnlColor } from "@/lib/utils";

export function PositionsTable({
  positions,
  currency = "USD",
}: {
  positions: EnrichedPosition[];
  currency?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this position?")) return;
    setPending(id);
    await fetch(`/api/positions/${id}`, { method: "DELETE" });
    setPending(null);
    router.refresh();
  }

  if (positions.length === 0) {
    return (
      <div className="card-pad text-center py-12">
        <p className="text-fg-muted">No positions yet.</p>
        <p className="text-sm text-fg-subtle mt-1">Add your first holding to start tracking.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-bg-elevated/40">
            <tr>
              <th className="th">Asset</th>
              <th className="th text-right">Qty</th>
              <th className="th text-right">Avg Cost</th>
              <th className="th text-right">Price</th>
              <th className="th text-right">Day</th>
              <th className="th text-right">Market Value</th>
              <th className="th text-right">P&amp;L</th>
              <th className="th text-right">Weight</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="hover:bg-bg-hover/40 transition-colors">
                <td className="td">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-bg-hover grid place-items-center text-xs font-semibold text-brand-300">
                      {p.symbol.slice(0, 3)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{p.symbol}</div>
                      <div className="text-xs text-fg-muted truncate max-w-[180px]">{p.name}</div>
                    </div>
                  </div>
                </td>
                <td className="td text-right tabular-nums">{formatNumber(p.quantity, 4)}</td>
                <td className="td text-right tabular-nums">{formatCurrency(p.avgCost, p.currency)}</td>
                <td className="td text-right tabular-nums">{formatCurrency(p.price, p.currency)}</td>
                <td className="td text-right">
                  <div className={cn("inline-flex items-center gap-1 tabular-nums", pnlColor(p.changePct))}>
                    {p.changePct > 0 ? <ArrowUp className="h-3 w-3" /> : p.changePct < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                    {formatPercent(p.changePct, 2)}
                  </div>
                </td>
                <td className="td text-right tabular-nums font-medium">
                  {formatCurrency(p.marketValue, currency)}
                </td>
                <td className="td text-right">
                  <div className={cn("tabular-nums font-medium", pnlColor(p.pnl))}>
                    {formatCurrency(p.pnl, currency)}
                  </div>
                  <div className={cn("text-xs tabular-nums", pnlColor(p.pnl))}>
                    {formatPercent(p.pnlPct, 2)}
                  </div>
                </td>
                <td className="td text-right tabular-nums text-fg-muted">
                  {formatPercent(p.weight, 1)}
                </td>
                <td className="td text-right">
                  <button
                    onClick={() => remove(p.id)}
                    disabled={pending === p.id}
                    className="btn-ghost !p-1.5"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
