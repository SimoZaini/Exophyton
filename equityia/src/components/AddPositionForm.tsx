"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";

type SearchResult = { symbol: string; name: string; exchange?: string; type?: string };

export function AddPositionForm({ portfolioId }: { portfolioId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const d: SearchResult[] = await r.json();
    setResults(d);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!picked) {
      setError("Pick a symbol from the search results.");
      return;
    }
    const payload = {
      symbol: picked.symbol,
      quantity: Number(quantity),
      avgCost: Number(avgCost),
      assetType: picked.type?.toUpperCase() === "ETF" ? "ETF" : picked.type?.toUpperCase() === "CRYPTOCURRENCY" ? "CRYPTO" : "EQUITY",
    };
    startTransition(async () => {
      const r = await fetch(`/api/portfolios/${portfolioId}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "Failed to add position");
        return;
      }
      setOpen(false);
      setQuery("");
      setResults([]);
      setPicked(null);
      setQuantity("");
      setAvgCost("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add position
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Add position</h3>
          <p className="text-sm text-fg-muted">Search for a stock, ETF or crypto ticker.</p>
        </div>

        <div>
          <label className="label">Symbol</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
            <input
              className="input pl-9"
              placeholder="e.g. AAPL, VWCE.DE, BTC-USD"
              value={picked ? `${picked.symbol} — ${picked.name}` : query}
              onChange={(e) => {
                setPicked(null);
                handleSearch(e.target.value);
              }}
            />
          </div>
          {!picked && results.length > 0 && (
            <ul className="mt-1 max-h-56 overflow-auto card divide-y divide-bg-border">
              {results.map((r) => (
                <li key={r.symbol}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(r);
                      setResults([]);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-bg-hover text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{r.symbol}</div>
                      <div className="text-xs text-fg-muted truncate">{r.name}</div>
                    </div>
                    <span className="text-[10px] uppercase text-fg-subtle">{r.type}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantity</label>
            <input
              className="input"
              type="number"
              step="any"
              min="0"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Avg cost</label>
            <input
              className="input"
              type="number"
              step="any"
              min="0"
              required
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="text-sm text-down">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
