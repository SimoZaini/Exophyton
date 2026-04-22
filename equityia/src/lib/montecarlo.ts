// Monte Carlo VaR / CVaR. Samples from N(μ, Σ) on per-symbol daily returns
// using Cholesky, aggregates into portfolio P&L over a horizon, and reports
// distribution percentiles.

import { cholesky, covarianceMatrix, mvnSample, percentile } from "./linalg";

export type MonteCarloInput = {
  symbols: string[];
  weights: number[];                  // sums to 1
  returnsMatrix: number[][];          // rows = dates, cols aligned with symbols
  portfolioValue: number;
  horizonDays: number;                // e.g. 21 for 1 month
  simulations?: number;               // default 10_000
};

export type MonteCarloResult = {
  horizonDays: number;
  simulations: number;
  expectedReturn: number;             // mean portfolio return over horizon
  expectedPnL: number;
  var95: number;                      // loss figure (positive number)
  var99: number;
  cvar95: number;
  cvar99: number;
  bestCase: number;                   // top 1% return
  worstCase: number;                  // bottom 1% return
  histogram: { bucket: number; count: number; pct: number }[];
};

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult | null {
  const { symbols, weights, returnsMatrix, portfolioValue, horizonDays } = input;
  const sims = input.simulations ?? 10_000;
  const k = symbols.length;
  const n = returnsMatrix.length;
  if (k === 0 || n < 30) return null;

  // Per-symbol mean.
  const means = Array(k).fill(0);
  for (const row of returnsMatrix) for (let j = 0; j < k; j++) means[j] += row[j];
  for (let j = 0; j < k; j++) means[j] /= n;

  const cov = covarianceMatrix(returnsMatrix);
  let L: number[][];
  try {
    L = cholesky(cov, 1e-8);
  } catch {
    return null;
  }

  const pnLs: number[] = [];
  for (let s = 0; s < sims; s++) {
    let compoundedPortfolioReturn = 0;
    // Simulate `horizonDays` independent daily draws, apply to portfolio return
    // via weights * daily-return vector; compound.
    let growth = 1;
    for (let t = 0; t < horizonDays; t++) {
      const draw = mvnSample(means, L);
      let dayRet = 0;
      for (let j = 0; j < k; j++) dayRet += weights[j] * draw[j];
      growth *= 1 + dayRet;
    }
    compoundedPortfolioReturn = growth - 1;
    pnLs.push(compoundedPortfolioReturn);
  }
  pnLs.sort((a, b) => a - b);

  const expectedReturn = pnLs.reduce((a, b) => a + b, 0) / sims;
  const var95Return = percentile(pnLs, 0.05);
  const var99Return = percentile(pnLs, 0.01);

  const tail95 = pnLs.slice(0, Math.max(1, Math.floor(0.05 * sims)));
  const tail99 = pnLs.slice(0, Math.max(1, Math.floor(0.01 * sims)));
  const cvar95Return = tail95.reduce((a, b) => a + b, 0) / tail95.length;
  const cvar99Return = tail99.reduce((a, b) => a + b, 0) / tail99.length;

  // Build 30-bucket histogram of returns.
  const minR = pnLs[0];
  const maxR = pnLs[sims - 1];
  const buckets = 30;
  const width = (maxR - minR) / buckets || 1;
  const counts = Array(buckets).fill(0);
  for (const r of pnLs) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((r - minR) / width)));
    counts[idx]++;
  }
  const histogram = counts.map((c, i) => ({
    bucket: minR + (i + 0.5) * width,
    count: c,
    pct: c / sims,
  }));

  return {
    horizonDays,
    simulations: sims,
    expectedReturn,
    expectedPnL: expectedReturn * portfolioValue,
    var95: -var95Return * portfolioValue,
    var99: -var99Return * portfolioValue,
    cvar95: -cvar95Return * portfolioValue,
    cvar99: -cvar99Return * portfolioValue,
    bestCase: percentile(pnLs, 0.99),
    worstCase: percentile(pnLs, 0.01),
    histogram,
  };
}
