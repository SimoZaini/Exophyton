// Markowitz mean-variance optimizer with long-only + fully-invested constraints.
//
// We solve two classical targets:
//   - min variance : arg min  w^T Σ w           s.t.  Σ w = 1, w ≥ 0
//   - max Sharpe   : arg max  (μ − rf)·w / √(w^T Σ w)  s.t.  Σ w = 1, w ≥ 0
//
// Rather than a full QP solver, we use projected-gradient descent with
// simplex projection (Duchi 2008). This is ~50 lines and robust for the
// small problems we care about (10–30 assets).

import { covarianceMatrix, matVec } from "./linalg";

export type OptimizerInput = {
  symbols: string[];
  currentWeights: number[]; // 0..1, sums to 1
  returnsMatrix: number[][]; // rows = dates, cols aligned with symbols
  annualRiskFree?: number;   // default 4%
};

export type TargetPortfolio = {
  target: "min_variance" | "max_sharpe";
  weights: number[];
  expectedReturn: number; // annualized
  expectedVol: number;    // annualized
  sharpe: number;
  // Rebalancing trades in $: positive = buy, negative = sell.
  trades: { symbol: string; deltaWeight: number; tradeUsd: number }[];
};

export type OptimizerResult = {
  symbols: string[];
  expectedReturns: number[]; // annualized μ
  covarianceAnnualized: number[][];
  currentStats: { expectedReturn: number; expectedVol: number; sharpe: number };
  minVariance: TargetPortfolio;
  maxSharpe: TargetPortfolio;
};

const TRADING_DAYS = 252;

// Project a vector onto the simplex {w : sum(w)=1, w ≥ 0} using the
// algorithm of Duchi et al. 2008 ("Efficient Projections onto the
// l1-ball..."). O(k log k) per call.
function projectSimplex(v: number[]): number[] {
  const k = v.length;
  const u = [...v].sort((a, b) => b - a);
  let cumSum = 0;
  let rho = 0;
  let theta = 0;
  for (let i = 0; i < k; i++) {
    cumSum += u[i];
    const t = (cumSum - 1) / (i + 1);
    if (u[i] - t > 0) {
      rho = i + 1;
      theta = t;
    }
  }
  // theta is set during the last qualifying iteration; if nothing qualifies
  // (shouldn't happen for reasonable inputs), default to equal weighting.
  if (rho === 0) return Array(k).fill(1 / k);
  return v.map((x) => Math.max(0, x - theta));
}

function minVariance(cov: number[][], maxIters = 800, lr = 0.5): number[] {
  const k = cov.length;
  let w = Array(k).fill(1 / k);
  let prev = Infinity;
  for (let iter = 0; iter < maxIters; iter++) {
    // ∇(wᵀ Σ w) = 2 Σ w
    const grad = matVec(cov, w).map((g) => 2 * g);
    const stepped = w.map((wi, i) => wi - lr * grad[i]);
    w = projectSimplex(stepped);
    const obj = dot(w, matVec(cov, w));
    if (Math.abs(prev - obj) < 1e-12) break;
    prev = obj;
  }
  return w;
}

function maxSharpe(mu: number[], cov: number[][], maxIters = 1200, lr = 1.0): number[] {
  const k = mu.length;
  let w = Array(k).fill(1 / k);
  for (let iter = 0; iter < maxIters; iter++) {
    const sigW = matVec(cov, w);
    const variance = Math.max(1e-12, dot(w, sigW));
    const std = Math.sqrt(variance);
    const wMu = dot(w, mu);
    // ∇(μ·w / √(wΣw)) = μ/σ − (μ·w)·Σw / σ³
    const grad = mu.map((mi, i) => mi / std - (wMu * sigW[i]) / (variance * std));
    const stepped = w.map((wi, i) => wi + lr * grad[i]);
    w = projectSimplex(stepped);
  }
  return w;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function describePortfolio(
  w: number[],
  muAnn: number[],
  covAnn: number[][],
  rf: number
): { expectedReturn: number; expectedVol: number; sharpe: number } {
  const expectedReturn = dot(w, muAnn);
  const variance = Math.max(0, dot(w, matVec(covAnn, w)));
  const expectedVol = Math.sqrt(variance);
  const sharpe = expectedVol > 0 ? (expectedReturn - rf) / expectedVol : 0;
  return { expectedReturn, expectedVol, sharpe };
}

function tradesFrom(
  symbols: string[],
  current: number[],
  target: number[],
  portfolioValue: number
): { symbol: string; deltaWeight: number; tradeUsd: number }[] {
  return symbols.map((sym, i) => ({
    symbol: sym,
    deltaWeight: target[i] - current[i],
    tradeUsd: (target[i] - current[i]) * portfolioValue,
  }));
}

export function runOptimizer(
  input: OptimizerInput,
  portfolioValue: number
): OptimizerResult | null {
  const { symbols, currentWeights, returnsMatrix } = input;
  const rf = input.annualRiskFree ?? 0.04;
  const k = symbols.length;
  if (k === 0 || returnsMatrix.length < 30) return null;

  // Daily mean per asset → annualize μ; covariance daily → annualize Σ.
  const muDaily = Array(k).fill(0);
  for (const row of returnsMatrix) for (let j = 0; j < k; j++) muDaily[j] += row[j];
  for (let j = 0; j < k; j++) muDaily[j] /= returnsMatrix.length;
  const muAnn = muDaily.map((m) => m * TRADING_DAYS);

  const covD = covarianceMatrix(returnsMatrix);
  const covAnn = covD.map((row) => row.map((v) => v * TRADING_DAYS));

  const wMinVar = minVariance(covAnn);
  const wMaxSharpe = maxSharpe(
    muAnn.map((m) => m - rf),
    covAnn
  );

  const currentStats = describePortfolio(currentWeights, muAnn, covAnn, rf);
  const minVarStats = describePortfolio(wMinVar, muAnn, covAnn, rf);
  const maxSharpeStats = describePortfolio(wMaxSharpe, muAnn, covAnn, rf);

  return {
    symbols,
    expectedReturns: muAnn,
    covarianceAnnualized: covAnn,
    currentStats,
    minVariance: {
      target: "min_variance",
      weights: wMinVar,
      ...minVarStats,
      trades: tradesFrom(symbols, currentWeights, wMinVar, portfolioValue),
    },
    maxSharpe: {
      target: "max_sharpe",
      weights: wMaxSharpe,
      ...maxSharpeStats,
      trades: tradesFrom(symbols, currentWeights, wMaxSharpe, portfolioValue),
    },
  };
}
