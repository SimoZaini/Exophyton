"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";

export function ReceiveDividendButton({
  symbol,
  suggestedAmount,
}: {
  symbol: string;
  suggestedAmount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggestedAmount ? suggestedAmount.toFixed(2) : "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      const r = await fetch("/api/dividends/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          amount: Number(amount),
          date: new Date(date).toISOString(),
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? "Failed");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        className="text-xs text-brand-400 hover:text-brand-300 inline-flex items-center gap-1"
        onClick={() => setOpen(true)}
        title="Log a received dividend for this symbol"
      >
        <CircleCheck className="h-3 w-3" /> Log
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Log dividend received</h3>
          <p className="text-sm text-fg-muted">{symbol}</p>
        </div>

        <div>
          <label className="label">Amount (cash received)</label>
          <input
            className="input"
            type="number"
            step="any"
            min="0"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Date</label>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {err && <div className="text-sm text-down">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
