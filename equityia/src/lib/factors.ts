// Fama-French-style factor regression, using liquid ETF proxies to construct
// daily factor return series. No dependency on the Kenneth French data
// library — works off the same yahoo pipeline we already use.
//
// Factors:
//   MKT  : SPY daily return − risk-free daily rate
//   SMB  : IWM (small-cap)  − SPY (broad)   "small minus big"
//   HML  : IWD (Russell 1000 Value) − IWF (Russell 1000 Growth)   "value minus growth"
//
// A 4th "quality" factor can be approximated by QUAL − SPY if desired; we
// include it as an optional toggle via the `includeQuality` flag.

import { cachedHistorical } from "./market";
import { ols } from "./linalg";

export type FactorName = "MKT" | "SMB" | "HML" | "QMJ";

export type FactorRegression = {
  alpha: number;          // daily alpha
  alphaAnnualized: number;
  betas: Record<FactorName, number>;
  tStats: Record<"alpha" | FactorName, number>;
  rSquared: number;
  adjRSquared: number;
  residualVol: number;    // daily
  residualVolAnn: number; // annualized (√252)
  n: number;              // observations
  factors: FactorName[];
};

type DatedReturns = Map<string, number>; // ISO date (YYYY-MM-DD) -> return

function toDated(series: { date: Date; close: number }[]): DatedReturns {
  const out: DatedReturns = new Map();
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1].close;
    const cur = series[i].close;
    if (prev <= 0) continue;
    const k = series[i].date.toISOString().slice(0, 10);
    out.set(k, cur / prev - 1);
  }
  return out;
}

export async function buildFactorReturns(
  period: "1y" | "2y" | "5y" = "1y",
  includeQuality = false,
  annualRiskFree = 0.04
): Promise<{
  factors: FactorName[];
  dates: string[];
  matrix: number[][]; // rows = dates, cols = factors (in order)
}> {
  const [spy, iwm, iwd, iwf, qual] = await Promise.all([
    cachedHistorical("SPY", period),
    cachedHistorical("IWM", period),
    cachedHistorical("IWD", period),
    cachedHistorical("IWF", period),
    includeQuality ? cachedHistorical("QUAL", period) : Promise.resolve([]),
  ]);

  const rSpy = toDated(spy);
  const rIwm = toDated(iwm);
  const rIwd = toDated(iwd);
  const rIwf = toDated(iwf);
  const rQual = toDated(qual);

  const rfDaily = annualRiskFree / 252;
  const factorList: FactorName[] = ["MKT", "SMB", "HML"];
  if (includeQuality) factorList.push("QMJ");

  const dates: string[] = [];
  const matrix: number[][] = [];
  for (const [d, spyR] of rSpy) {
    const iwmR = rIwm.get(d);
    const iwdR = rIwd.get(d);
    const iwfR = rIwf.get(d);
    if (iwmR == null || iwdR == null || iwfR == null) continue;
    const row = [spyR - rfDaily, iwmR - spyR, iwdR - iwfR];
    if (includeQuality) {
      const qR = rQual.get(d);
      if (qR == null) continue;
      row.push(qR - spyR);
    }
    dates.push(d);
    matrix.push(row);
  }
  return { factors: factorList, dates, matrix };
}

// Align portfolio daily returns with factor dates, then run OLS.
// `portfolioSeries` should already be a value series (one point per day);
// we compute its daily returns and intersect with factor dates.
export async function runFactorRegression(
  portfolioSeries: { date: Date; value: number }[],
  period: "1y" | "2y" | "5y" = "1y",
  includeQuality = false,
  annualRiskFree = 0.04
): Promise<FactorRegression | null> {
  if (portfolioSeries.length < 30) return null;

  const portDated = new Map<string, number>();
  for (let i = 1; i < portfolioSeries.length; i++) {
    const prev = portfolioSeries[i - 1].value;
    const cur = portfolioSeries[i].value;
    if (prev <= 0) continue;
    portDated.set(portfolioSeries[i].date.toISOString().slice(0, 10), cur / prev - 1);
  }

  const { factors, dates, matrix } = await buildFactorReturns(period, includeQuality, annualRiskFree);
  if (dates.length < 30) return null;

  // Align dates that exist in both portfolio returns and factor set.
  const X: number[][] = []; // [intercept, factor1, factor2, ...]
  const y: number[] = [];
  const rfDaily = annualRiskFree / 252;
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const r = portDated.get(d);
    if (r == null) continue;
    X.push([1, ...matrix[i]]);
    y.push(r - rfDaily); // excess portfolio return
  }
  if (X.length < factors.length + 5) return null;

  const res = ols(X, y);
  const alpha = res.coefficients[0];
  const betasArr = res.coefficients.slice(1);
  const betas: Record<FactorName, number> = { MKT: 0, SMB: 0, HML: 0, QMJ: 0 };
  factors.forEach((f, i) => (betas[f] = betasArr[i]));
  const tStats: Record<"alpha" | FactorName, number> = {
    alpha: res.tStats[0],
    MKT: 0, SMB: 0, HML: 0, QMJ: 0,
  };
  factors.forEach((f, i) => (tStats[f] = res.tStats[i + 1]));

  return {
    alpha,
    alphaAnnualized: alpha * 252,
    betas,
    tStats,
    rSquared: res.rSquared,
    adjRSquared: res.adjRSquared,
    residualVol: res.residualStd,
    residualVolAnn: res.residualStd * Math.sqrt(252),
    n: res.n,
    factors,
  };
}
