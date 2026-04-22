// Minimal linear algebra + regression utilities used by factor models,
// Markowitz optimization and Monte Carlo simulations. Pure TS, no deps.

export type Matrix = number[][];

export function zeros(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

export function identity(n: number): Matrix {
  const m = zeros(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export function transpose(m: Matrix): Matrix {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const out = zeros(cols, rows);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) out[j][i] = m[i][j];
  return out;
}

export function matMul(a: Matrix, b: Matrix): Matrix {
  const aRows = a.length;
  const aCols = a[0]?.length ?? 0;
  const bCols = b[0]?.length ?? 0;
  const out = zeros(aRows, bCols);
  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      const aik = a[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < bCols; j++) out[i][j] += aik * b[k][j];
    }
  }
  return out;
}

export function matVec(m: Matrix, v: number[]): number[] {
  const rows = m.length;
  const out = new Array(rows).fill(0);
  for (let i = 0; i < rows; i++) {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += m[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

// Invert a square matrix via Gauss-Jordan elimination with partial pivoting.
// Throws if the matrix is singular (or numerically close to it).
export function invert(m: Matrix): Matrix {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...identity(n)[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k;
    }
    if (Math.abs(a[pivot][i]) < 1e-12) {
      throw new Error("Singular matrix");
    }
    if (pivot !== i) [a[i], a[pivot]] = [a[pivot], a[i]];
    const div = a[i][i];
    for (let j = 0; j < 2 * n; j++) a[i][j] /= div;
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = a[k][i];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) a[k][j] -= factor * a[i][j];
    }
  }
  return a.map((row) => row.slice(n));
}

// Cholesky decomposition: A = L L^T where L is lower-triangular.
// Assumes A is positive-definite symmetric. Adds small ridge on failure.
export function cholesky(A: Matrix, ridge = 1e-10): Matrix {
  const n = A.length;
  const L = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        const diag = A[i][i] - sum + ridge;
        if (diag <= 0) throw new Error("Matrix is not positive definite");
        L[i][j] = Math.sqrt(diag);
      } else {
        L[i][j] = (A[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

// Ordinary least squares: β = (X^T X)^-1 X^T y. Returns coefficients plus
// diagnostics (R², adjusted R², standard errors, t-stats).
export type OLSResult = {
  coefficients: number[];
  stdErrors: number[];
  tStats: number[];
  rSquared: number;
  adjRSquared: number;
  residualStd: number;
  n: number;
  k: number;
};

export function ols(X: Matrix, y: number[]): OLSResult {
  const n = X.length;
  const k = X[0]?.length ?? 0;
  if (n <= k) throw new Error("OLS requires n > k (more obs than regressors)");

  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXInv = invert(XtX);
  const Xty = matVec(Xt, y);
  const beta = matVec(XtXInv, Xty);

  const yHat = matVec(X, beta);
  const residuals = y.map((yi, i) => yi - yHat[i]);
  const rss = residuals.reduce((s, r) => s + r * r, 0);
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const tss = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const rSquared = tss > 0 ? 1 - rss / tss : 0;
  const adjRSquared = n > k ? 1 - ((1 - rSquared) * (n - 1)) / (n - k) : 0;
  const sigma2 = rss / Math.max(1, n - k);
  const residualStd = Math.sqrt(sigma2);
  const stdErrors = XtXInv.map((row, i) => Math.sqrt(Math.max(0, sigma2 * row[i])));
  const tStats = beta.map((b, i) => (stdErrors[i] > 0 ? b / stdErrors[i] : 0));

  return { coefficients: beta, stdErrors, tStats, rSquared, adjRSquared, residualStd, n, k };
}

// Sample covariance matrix from a matrix of observations (rows=obs, cols=vars).
export function covarianceMatrix(X: Matrix): Matrix {
  const n = X.length;
  const k = X[0]?.length ?? 0;
  if (n < 2) return zeros(k, k);
  const means = Array(k).fill(0);
  for (const row of X) for (let j = 0; j < k; j++) means[j] += row[j];
  for (let j = 0; j < k; j++) means[j] /= n;
  const cov = zeros(k, k);
  for (const row of X) {
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        cov[i][j] += (row[i] - means[i]) * (row[j] - means[j]);
      }
    }
  }
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) cov[i][j] /= n - 1;
  return cov;
}

// Box-Muller: generate one standard normal sample.
export function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Draw one sample from a multivariate normal N(mean, Σ) using a Cholesky
// factor L of Σ (precomputed for efficiency across many samples).
export function mvnSample(mean: number[], cholFactor: Matrix): number[] {
  const k = mean.length;
  const z = Array.from({ length: k }, randn);
  const out = new Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    let s = 0;
    for (let j = 0; j <= i; j++) s += cholFactor[i][j] * z[j];
    out[i] = mean[i] + s;
  }
  return out;
}

// Linear-algebra percentile (lower = p-th percentile of sorted array).
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * sortedAsc.length)));
  return sortedAsc[idx];
}
