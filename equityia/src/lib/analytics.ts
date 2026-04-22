// Risk & performance analytics in pure TypeScript.
// Inspired by the metrics institutional platforms (Aladdin, Factset) surface:
// returns, volatility, Sharpe, Sortino, max drawdown, beta, VaR, CVaR.

export type Series = { date: Date; value: number }[];

const TRADING_DAYS = 252;

export function dailyReturns(series: Series): number[] {
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].value;
    const cur = series[i].value;
    if (prev > 0) rets.push(cur / prev - 1);
  }
  return rets;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function annualizedReturn(series: Series): number {
  if (series.length < 2) return 0;
  const first = series[0].value;
  const last = series[series.length - 1].value;
  if (first <= 0) return 0;
  const days = (series[series.length - 1].date.getTime() - series[0].date.getTime()) / 86_400_000;
  if (days <= 0) return 0;
  return (last / first) ** (365 / days) - 1;
}

export function annualizedVolatility(returns: number[]): number {
  return stdev(returns) * Math.sqrt(TRADING_DAYS);
}

export function sharpeRatio(returns: number[], riskFreeRate = 0.04): number {
  const annRet = mean(returns) * TRADING_DAYS;
  const annVol = annualizedVolatility(returns);
  if (annVol === 0) return 0;
  return (annRet - riskFreeRate) / annVol;
}

export function sortinoRatio(returns: number[], riskFreeRate = 0.04): number {
  const annRet = mean(returns) * TRADING_DAYS;
  const downside = returns.filter((r) => r < 0);
  if (downside.length === 0) return Number.POSITIVE_INFINITY;
  const dd = Math.sqrt(mean(downside.map((r) => r * r))) * Math.sqrt(TRADING_DAYS);
  if (dd === 0) return 0;
  return (annRet - riskFreeRate) / dd;
}

export function maxDrawdown(series: Series): { maxDD: number; peakDate?: Date; troughDate?: Date } {
  let peak = -Infinity;
  let maxDD = 0;
  let peakDate: Date | undefined;
  let troughDate: Date | undefined;
  let currentPeakDate: Date | undefined;
  for (const p of series) {
    if (p.value > peak) {
      peak = p.value;
      currentPeakDate = p.date;
    }
    const dd = peak > 0 ? p.value / peak - 1 : 0;
    if (dd < maxDD) {
      maxDD = dd;
      peakDate = currentPeakDate;
      troughDate = p.date;
    }
  }
  return { maxDD, peakDate, troughDate };
}

// Historical Value-at-Risk at given confidence (e.g. 0.95 => 5% left tail).
export function historicalVaR(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return -sorted[idx];
}

// Conditional VaR (Expected Shortfall).
export function historicalCVaR(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0;
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.max(1, Math.floor((1 - confidence) * sorted.length));
  const tail = sorted.slice(0, cutoff);
  return -mean(tail);
}

export function beta(portfolioReturns: number[], benchmarkReturns: number[]): number {
  const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
  if (n < 2) return 0;
  const p = portfolioReturns.slice(-n);
  const b = benchmarkReturns.slice(-n);
  const mp = mean(p);
  const mb = mean(b);
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    cov += (p[i] - mp) * (b[i] - mb);
    varB += (b[i] - mb) ** 2;
  }
  if (varB === 0) return 0;
  return cov / varB;
}

// Build a portfolio value series from a map of weights and per-symbol price series.
// weights are dollars per symbol at each point (since sharesPerSymbol is constant we
// just sum shares * price).
export function portfolioValueSeries(
  holdings: { symbol: string; quantity: number }[],
  priceSeries: Record<string, { date: Date; close: number }[]>
): Series {
  const dateSets = holdings
    .map((h) => priceSeries[h.symbol])
    .filter(Boolean)
    .map((s) => new Set(s.map((p) => p.date.toISOString().slice(0, 10))));
  if (dateSets.length === 0) return [];
  const common = [...dateSets[0]].filter((d) => dateSets.every((s) => s.has(d))).sort();
  const priceLookup: Record<string, Record<string, number>> = {};
  for (const [sym, arr] of Object.entries(priceSeries)) {
    priceLookup[sym] = {};
    for (const p of arr) priceLookup[sym][p.date.toISOString().slice(0, 10)] = p.close;
  }
  const out: Series = [];
  for (const dateStr of common) {
    let total = 0;
    for (const h of holdings) {
      const price = priceLookup[h.symbol]?.[dateStr];
      if (price == null) continue;
      total += h.quantity * price;
    }
    out.push({ date: new Date(dateStr), value: total });
  }
  return out;
}

export type RiskSummary = {
  annualReturn: number;
  annualVol: number;
  sharpe: number;
  sortino: number;
  maxDD: number;
  var95: number;
  cvar95: number;
  beta?: number;
};

export function computeRiskSummary(series: Series, benchmarkReturns?: number[]): RiskSummary {
  const rets = dailyReturns(series);
  return {
    annualReturn: annualizedReturn(series),
    annualVol: annualizedVolatility(rets),
    sharpe: sharpeRatio(rets),
    sortino: sortinoRatio(rets),
    maxDD: maxDrawdown(series).maxDD,
    var95: historicalVaR(rets, 0.95),
    cvar95: historicalCVaR(rets, 0.95),
    beta: benchmarkReturns ? beta(rets, benchmarkReturns) : undefined,
  };
}

// Build a (dates × symbols) matrix of daily returns, aligned on dates present
// in every symbol's series. Used by Monte Carlo VaR and the optimizer.
export function alignedReturnsMatrix(
  symbols: string[],
  priceSeries: Record<string, { date: Date; close: number }[]>
): { dates: string[]; matrix: number[][] } {
  const perSymbolReturns: Record<string, Map<string, number>> = {};
  for (const sym of symbols) {
    const arr = priceSeries[sym] ?? [];
    const m = new Map<string, number>();
    for (let i = 1; i < arr.length; i++) {
      const prev = arr[i - 1].close;
      const cur = arr[i].close;
      if (prev <= 0) continue;
      m.set(arr[i].date.toISOString().slice(0, 10), cur / prev - 1);
    }
    perSymbolReturns[sym] = m;
  }
  if (symbols.length === 0) return { dates: [], matrix: [] };
  const first = perSymbolReturns[symbols[0]];
  const common = [...first.keys()]
    .filter((d) => symbols.every((s) => perSymbolReturns[s].has(d)))
    .sort();
  const matrix: number[][] = [];
  for (const d of common) {
    matrix.push(symbols.map((s) => perSymbolReturns[s].get(d) ?? 0));
  }
  return { dates: common, matrix };
}
