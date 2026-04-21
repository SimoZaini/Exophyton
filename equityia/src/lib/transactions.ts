import type { Transaction } from "@prisma/client";
import { prisma } from "./prisma";
import { refreshProfile } from "./fundamentals";

export type TxType = "BUY" | "SELL" | "DIVIDEND" | "FEE";

export type ApplyTransactionInput = {
  portfolioId: string;
  symbol: string;
  type: TxType;
  quantity: number;
  price: number;
  fees: number;
  currency: string;
  executedAt: Date;
  note?: string;
};

// Create a transaction and update the backing Position accordingly.
// - BUY  : increases quantity, updates weighted average cost.
// - SELL : decreases quantity (keeps avgCost). Fails if > current qty.
// - DIVIDEND / FEE : no position quantity change.
export async function applyTransaction(input: ApplyTransactionInput): Promise<Transaction> {
  const symbol = input.symbol.toUpperCase();

  return prisma.$transaction(async (db) => {
    const existing = await db.position.findUnique({
      where: { portfolioId_symbol: { portfolioId: input.portfolioId, symbol } },
    });

    if (input.type === "BUY") {
      if (input.quantity <= 0) throw new Error("BUY quantity must be > 0");
      if (input.price <= 0) throw new Error("BUY price must be > 0");
      if (existing) {
        const newQty = existing.quantity + input.quantity;
        const newAvg = (existing.avgCost * existing.quantity + input.price * input.quantity) / newQty;
        await db.position.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgCost: newAvg },
        });
      } else {
        await db.position.create({
          data: {
            portfolioId: input.portfolioId,
            symbol,
            quantity: input.quantity,
            avgCost: input.price,
            currency: input.currency,
          },
        });
        refreshProfile(symbol).catch(() => null);
      }
    } else if (input.type === "SELL") {
      if (!existing) throw new Error(`No open position on ${symbol} to sell`);
      if (input.quantity <= 0) throw new Error("SELL quantity must be > 0");
      if (input.quantity > existing.quantity + 1e-9) {
        throw new Error(`SELL quantity exceeds current holding (${existing.quantity})`);
      }
      const newQty = existing.quantity - input.quantity;
      if (newQty <= 1e-9) {
        await db.position.delete({ where: { id: existing.id } });
      } else {
        await db.position.update({
          where: { id: existing.id },
          data: { quantity: newQty },
        });
      }
    }
    // DIVIDEND / FEE: no position change; only logged.

    return db.transaction.create({
      data: {
        portfolioId: input.portfolioId,
        symbol,
        type: input.type,
        quantity: input.quantity,
        price: input.price,
        fees: input.fees,
        currency: input.currency,
        executedAt: input.executedAt,
        note: input.note,
      },
    });
  });
}

// Reverse the effect of a transaction on its position, then delete it.
export async function revertTransaction(tx: Transaction): Promise<void> {
  await prisma.$transaction(async (db) => {
    const existing = await db.position.findUnique({
      where: { portfolioId_symbol: { portfolioId: tx.portfolioId, symbol: tx.symbol } },
    });

    if (tx.type === "BUY" && existing) {
      const newQty = existing.quantity - tx.quantity;
      if (newQty <= 1e-9) {
        await db.position.delete({ where: { id: existing.id } });
      } else {
        // Recompute avgCost by backing out this buy (if still positive).
        const totalCost = existing.avgCost * existing.quantity - tx.price * tx.quantity;
        const newAvg = newQty > 0 ? Math.max(totalCost / newQty, 0) : 0;
        await db.position.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgCost: newAvg },
        });
      }
    } else if (tx.type === "SELL") {
      // Undo a sell => add quantity back. We don't know the original avgCost,
      // so preserve current avgCost if position still open; otherwise use price
      // on the sold tx as a reasonable fallback.
      if (existing) {
        await db.position.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + tx.quantity },
        });
      } else {
        await db.position.create({
          data: {
            portfolioId: tx.portfolioId,
            symbol: tx.symbol,
            quantity: tx.quantity,
            avgCost: tx.price || 0,
            currency: tx.currency,
          },
        });
      }
    }

    await db.transaction.delete({ where: { id: tx.id } });
  });
}

// Parse a simple CSV into transaction inputs. Expected columns (header row,
// case-insensitive, any order):
//   date, symbol, type, quantity, price, fees, currency, note
// type is one of BUY/SELL/DIVIDEND/FEE (case-insensitive).
export function parseTransactionsCsv(
  csv: string,
  portfolioId: string
): { rows: ApplyTransactionInput[]; errors: { line: number; reason: string }[] } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: [{ line: 0, reason: "CSV must have header + rows" }] };

  // Detect delimiter: default to `,`, fallback to `;` if no commas in header.
  const headerLine = lines[0];
  const delim = headerLine.includes(",") ? "," : ";";
  const header = headerLine.split(delim).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iDate = idx("date");
  const iSymbol = idx("symbol");
  const iType = idx("type");
  const iQty = idx("quantity");
  const iPrice = idx("price");
  const iFees = idx("fees");
  const iCur = idx("currency");
  const iNote = idx("note");

  if (iDate < 0 || iSymbol < 0 || iType < 0 || iQty < 0) {
    return {
      rows: [],
      errors: [{ line: 1, reason: "Missing required columns: date, symbol, type, quantity" }],
    };
  }

  const rows: ApplyTransactionInput[] = [];
  const errors: { line: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const cols = raw.split(delim).map((c) => c.trim());
    try {
      const dateStr = cols[iDate];
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) throw new Error(`Invalid date '${dateStr}'`);
      const typeUp = (cols[iType] || "").toUpperCase();
      if (!["BUY", "SELL", "DIVIDEND", "FEE"].includes(typeUp)) {
        throw new Error(`Invalid type '${cols[iType]}'`);
      }
      const qty = Number(cols[iQty]);
      if (!isFinite(qty) || qty < 0) throw new Error(`Invalid quantity '${cols[iQty]}'`);
      const price = iPrice >= 0 ? Number(cols[iPrice] || 0) : 0;
      const fees = iFees >= 0 ? Number(cols[iFees] || 0) : 0;
      const currency = (iCur >= 0 ? cols[iCur] : "") || "USD";
      const note = iNote >= 0 ? cols[iNote] : undefined;
      rows.push({
        portfolioId,
        symbol: (cols[iSymbol] || "").toUpperCase(),
        type: typeUp as TxType,
        quantity: qty,
        price: isFinite(price) ? price : 0,
        fees: isFinite(fees) ? fees : 0,
        currency: currency.toUpperCase().slice(0, 3),
        executedAt: d,
        note: note || undefined,
      });
    } catch (e) {
      errors.push({ line: i + 1, reason: (e as Error).message });
    }
  }
  return { rows, errors };
}

// Sum DIVIDEND transaction amounts (quantity * price) between start and now.
export async function dividendsReceivedBetween(userId: string, start: Date, end: Date): Promise<number> {
  const rows = await prisma.transaction.findMany({
    where: {
      type: "DIVIDEND",
      executedAt: { gte: start, lte: end },
      portfolio: { userId },
    },
    select: { quantity: true, price: true },
  });
  return rows.reduce((sum, r) => sum + r.quantity * r.price, 0);
}
