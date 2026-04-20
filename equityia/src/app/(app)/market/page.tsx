import { Topbar } from "@/components/Topbar";
import { getQuotes } from "@/lib/market";
import { cn, formatCurrency, formatPercent, pnlColor } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const WATCH = ["SPY", "QQQ", "DIA", "IWM", "VXX", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOG", "META", "BTC-USD", "ETH-USD"];

export default async function MarketPage() {
  const quotes = await getQuotes(WATCH);
  const rows = WATCH.map((s) => quotes[s]).filter(Boolean);

  return (
    <>
      <Topbar title="Market" subtitle="Benchmarks and popular tickers" />
      <main className="flex-1 overflow-auto p-6">
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-bg-elevated/40">
              <tr>
                <th className="th">Ticker</th>
                <th className="th">Name</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">Change</th>
                <th className="th text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.symbol} className="hover:bg-bg-hover/40">
                  <td className="td font-medium">{q.symbol}</td>
                  <td className="td text-fg-muted">{q.name}</td>
                  <td className="td text-right tabular-nums">{formatCurrency(q.price, q.currency)}</td>
                  <td className={cn("td text-right tabular-nums", pnlColor(q.change))}>
                    {formatCurrency(q.change, q.currency)}
                  </td>
                  <td className={cn("td text-right tabular-nums", pnlColor(q.changePct))}>
                    {formatPercent(q.changePct, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
