"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, Coins, Minus, Plus, Trash2, Upload } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

type Portfolio = { id: string; name: string; baseCurrency: string };
type Tx = {
  id: string;
  portfolioId: string;
  symbol: string;
  type: string;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  executedAt: string;
  note: string | null;
};

const TYPES = ["BUY", "SELL", "DIVIDEND", "FEE"] as const;

export function TransactionsClient({
  portfolios,
  transactions,
}: {
  portfolios: Portfolio[];
  transactions: Tx[];
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [portfolioFilter, setPortfolioFilter] = useState<string>("");
  const [symbolFilter, setSymbolFilter] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const pMap = useMemo(
    () => Object.fromEntries(portfolios.map((p) => [p.id, p.name])),
    [portfolios]
  );

  const filtered = transactions.filter((t) => {
    if (typeFilter && t.type !== typeFilter) return false;
    if (portfolioFilter && t.portfolioId !== portfolioFilter) return false;
    if (symbolFilter && !t.symbol.toLowerCase().includes(symbolFilter.toLowerCase())) return false;
    return true;
  });

  const totals = useMemo(() => {
    let invested = 0;
    let realized = 0;
    let dividends = 0;
    let fees = 0;
    for (const t of filtered) {
      const notional = t.quantity * t.price;
      if (t.type === "BUY") invested += notional + t.fees;
      else if (t.type === "SELL") realized += notional - t.fees;
      else if (t.type === "DIVIDEND") dividends += notional;
      else if (t.type === "FEE") fees += notional;
    }
    return { invested, realized, dividends, fees };
  }, [filtered]);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi">
          <span className="kpi-label"><ArrowUpCircle className="inline h-3 w-3 mr-1" />Invested</span>
          <span className="kpi-value">{formatCurrency(totals.invested)}</span>
          <span className="text-sm text-fg-muted">sum of buys (incl. fees)</span>
        </div>
        <div className="kpi">
          <span className="kpi-label"><ArrowDownCircle className="inline h-3 w-3 mr-1" />Sold</span>
          <span className="kpi-value">{formatCurrency(totals.realized)}</span>
          <span className="text-sm text-fg-muted">gross proceeds</span>
        </div>
        <div className="kpi">
          <span className="kpi-label"><Coins className="inline h-3 w-3 mr-1" />Dividends logged</span>
          <span className="kpi-value text-up">{formatCurrency(totals.dividends)}</span>
          <span className="text-sm text-fg-muted">cash received</span>
        </div>
        <div className="kpi">
          <span className="kpi-label"><Minus className="inline h-3 w-3 mr-1" />Standalone fees</span>
          <span className="kpi-value">{formatCurrency(totals.fees)}</span>
          <span className="text-sm text-fg-muted">FEE entries only</span>
        </div>
      </div>

      <div className="card-pad">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label className="label">Type</label>
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="label">Portfolio</label>
            <select
              className="input"
              value={portfolioFilter}
              onChange={(e) => setPortfolioFilter(e.target.value)}
            >
              <option value="">All</option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="label">Symbol</label>
            <input
              className="input"
              placeholder="AAPL"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <button className="btn-outline" onClick={() => setShowImport(true)} disabled={portfolios.length === 0}>
              <Upload className="h-4 w-4" /> Import CSV
            </button>
            <button className="btn-primary" onClick={() => setShowAdd(true)} disabled={portfolios.length === 0}>
              <Plus className="h-4 w-4" /> New transaction
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-elevated/40">
              <tr>
                <th className="th">Date</th>
                <th className="th">Portfolio</th>
                <th className="th">Symbol</th>
                <th className="th">Type</th>
                <th className="th text-right">Quantity</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">Fees</th>
                <th className="th text-right">Amount</th>
                <th className="th">Note</th>
                <th className="th w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td className="td text-fg-muted" colSpan={10}>No transactions match the filters.</td>
                </tr>
              )}
              {filtered.map((t) => (
                <TxRow
                  key={t.id}
                  tx={t}
                  portfolioName={pMap[t.portfolioId] ?? "—"}
                  onDeleted={() => router.refresh()}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <AddTransactionModal
          portfolios={portfolios}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
      {showImport && (
        <ImportCsvModal
          portfolios={portfolios}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function TxRow({
  tx,
  portfolioName,
  onDeleted,
}: {
  tx: Tx;
  portfolioName: string;
  onDeleted: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const notional = tx.quantity * tx.price;
  const amount =
    tx.type === "BUY" ? -(notional + tx.fees) :
    tx.type === "SELL" ? notional - tx.fees :
    tx.type === "DIVIDEND" ? notional :
    -notional;

  async function del() {
    if (!confirm(`Delete ${tx.type} ${tx.symbol}? Position quantity will be reversed.`)) return;
    startTransition(async () => {
      const r = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
      if (r.ok) onDeleted();
      else alert((await r.json()).error ?? "Failed to delete");
    });
  }

  const color =
    tx.type === "BUY" ? "bg-brand-600/15 text-brand-300" :
    tx.type === "SELL" ? "bg-orange-500/15 text-orange-300" :
    tx.type === "DIVIDEND" ? "bg-emerald-500/15 text-emerald-300" :
    "bg-fg-muted/15 text-fg-muted";

  return (
    <tr className="hover:bg-bg-hover/40">
      <td className="td tabular-nums text-fg-muted">
        {new Date(tx.executedAt).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" })}
      </td>
      <td className="td text-fg-muted truncate max-w-[140px]">{portfolioName}</td>
      <td className="td font-medium">{tx.symbol}</td>
      <td className="td">
        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", color)}>
          {tx.type}
        </span>
      </td>
      <td className="td text-right tabular-nums">{tx.type === "DIVIDEND" || tx.type === "FEE" ? "—" : tx.quantity}</td>
      <td className="td text-right tabular-nums">{tx.price ? formatCurrency(tx.price, tx.currency) : "—"}</td>
      <td className="td text-right tabular-nums text-fg-muted">{tx.fees ? formatCurrency(tx.fees, tx.currency) : "—"}</td>
      <td className={cn("td text-right tabular-nums font-medium", amount >= 0 ? "text-up" : "text-down")}>
        {formatCurrency(amount, tx.currency)}
      </td>
      <td className="td text-fg-muted truncate max-w-[180px]">{tx.note ?? ""}</td>
      <td className="td">
        <button
          className="text-fg-subtle hover:text-down disabled:opacity-50"
          onClick={del}
          disabled={pending}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function AddTransactionModal({
  portfolios,
  onClose,
  onCreated,
}: {
  portfolios: Portfolio[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? "");
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("BUY");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload = {
      symbol: symbol.trim(),
      type,
      quantity: Number(quantity || 0),
      price: Number(price || 0),
      fees: Number(fees || 0),
      executedAt: new Date(date).toISOString(),
      note: note || undefined,
    };
    startTransition(async () => {
      const r = await fetch(`/api/portfolios/${portfolioId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setErr(j.error ?? "Failed");
        return;
      }
      onCreated();
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-lg p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">New transaction</h3>
          <p className="text-sm text-fg-muted">BUY/SELL update position quantity. DIVIDEND/FEE are cash-only.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Portfolio</label>
            <select className="input" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Symbol</label>
            <input
              className="input"
              required
              placeholder="AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">{type === "DIVIDEND" || type === "FEE" ? "(n/a)" : "Quantity"}</label>
            <input
              className="input"
              type="number"
              step="any"
              min="0"
              disabled={type === "DIVIDEND" || type === "FEE"}
              value={type === "DIVIDEND" || type === "FEE" ? "1" : quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{type === "DIVIDEND" ? "Cash amount" : type === "FEE" ? "Fee amount" : "Price"}</label>
            <input
              className="input"
              type="number"
              step="any"
              min="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Fees</label>
            <input
              className="input"
              type="number"
              step="any"
              min="0"
              value={fees}
              disabled={type === "DIVIDEND" || type === "FEE"}
              onChange={(e) => setFees(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Note</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>

        {err && <div className="text-sm text-down">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ImportCsvModal({
  portfolios,
  onClose,
  onImported,
}: {
  portfolios: Portfolio[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? "");
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<{ imported: number; failed: { line: number; reason: string }[]; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const txt = await file.text();
    setCsv(txt);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResult(null);
    startTransition(async () => {
      const r = await fetch(`/api/portfolios/${portfolioId}/transactions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(j.error ?? "Import failed");
        return;
      }
      setResult(j);
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
      <form onSubmit={submit} className="card w-full max-w-2xl p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Import transactions (CSV)</h3>
          <p className="text-sm text-fg-muted">
            Columns: <code>date,symbol,type,quantity,price,fees,currency,note</code>.
            Type = BUY / SELL / DIVIDEND / FEE.
          </p>
        </div>

        <div>
          <label className="label">Portfolio</label>
          <select className="input" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">CSV file</label>
          <input className="input" type="file" accept=".csv,text/csv" onChange={onFile} />
        </div>

        <div>
          <label className="label">Or paste CSV</label>
          <textarea
            className="input font-mono text-xs h-40"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"date,symbol,type,quantity,price,fees,currency\n2024-01-15,AAPL,BUY,10,185.50,1.00,USD"}
          />
        </div>

        {err && <div className="text-sm text-down">{err}</div>}

        {result && (
          <div className="rounded-md border border-bg-border p-3 text-sm space-y-2">
            <div>
              Imported <span className="text-up font-medium">{result.imported}</span> of {result.total}.
              {result.failed.length > 0 && (
                <> <span className="text-down font-medium">{result.failed.length} failed</span>.</>
              )}
            </div>
            {result.failed.length > 0 && (
              <ul className="max-h-32 overflow-auto text-xs text-fg-muted list-disc pl-4 space-y-0.5">
                {result.failed.slice(0, 20).map((f, i) => (
                  <li key={i}>
                    {f.line > 0 && <span className="text-fg-subtle">line {f.line}: </span>}
                    {f.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button type="submit" className="btn-primary" disabled={pending || !csv.trim()}>
              {pending ? "Importing..." : "Import"}
            </button>
          )}
          {result && (
            <button type="button" className="btn-primary" onClick={onImported}>Done</button>
          )}
        </div>
      </form>
    </div>
  );
}
