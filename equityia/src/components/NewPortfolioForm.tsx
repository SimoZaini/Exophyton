"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

export function NewPortfolioForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, baseCurrency: currency }),
      });
      if (!r.ok) {
        setError("Could not create portfolio");
        return;
      }
      setOpen(false);
      setName("");
      router.refresh();
    });
  }

  if (!open)
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> New portfolio
      </button>
    );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <h3 className="text-lg font-semibold">New portfolio</h3>
        <div>
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Base currency</label>
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CHF">CHF</option>
            <option value="CAD">CAD</option>
          </select>
        </div>
        {error && <div className="text-sm text-down">{error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={pending || !name}>
            {pending ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
