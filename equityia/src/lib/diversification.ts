import type { Breakdown, EnrichedPosition } from "./portfolio";

// Herfindahl-Hirschman Index: sum of squared weights.
// 1.0 = single holding, ~0 = fully diversified.
// Effective N = 1 / HHI.
export function hhi(weights: number[]): number {
  return weights.reduce((a, w) => a + w * w, 0);
}

export function effectiveN(weights: number[]): number {
  const h = hhi(weights);
  return h > 0 ? 1 / h : 0;
}

// Concentration score 0..100 (higher = more concentrated).
export function concentrationScore(weights: number[]): number {
  if (weights.length === 0) return 0;
  const h = hhi(weights);
  const hMin = 1 / weights.length; // fully equal-weighted
  if (h <= hMin) return 0;
  return Math.min(100, ((h - hMin) / (1 - hMin)) * 100);
}

export type DiversificationBucket = {
  label: string;
  weight: number;
};

export type DiversificationMetrics = {
  positionsHHI: number;
  positionsEffectiveN: number;
  sectorsHHI: number;
  sectorsEffectiveN: number;
  countriesHHI: number;
  countriesEffectiveN: number;
  top5Weight: number;
  top10Weight: number;
  largestSector?: DiversificationBucket;
  largestCountry?: DiversificationBucket;
  concentrationScore: number;
};

export function computeDiversification(
  positions: EnrichedPosition[],
  sectorBreakdown: Breakdown,
  countryBreakdown: Breakdown
): DiversificationMetrics {
  const posWeights = positions.map((p) => p.weight).sort((a, b) => b - a);
  const sectorWeights = sectorBreakdown.map((s) => s.pct);
  const countryWeights = countryBreakdown.map((c) => c.pct);

  const top5 = posWeights.slice(0, 5).reduce((a, b) => a + b, 0);
  const top10 = posWeights.slice(0, 10).reduce((a, b) => a + b, 0);

  return {
    positionsHHI: hhi(posWeights),
    positionsEffectiveN: effectiveN(posWeights),
    sectorsHHI: hhi(sectorWeights),
    sectorsEffectiveN: effectiveN(sectorWeights),
    countriesHHI: hhi(countryWeights),
    countriesEffectiveN: effectiveN(countryWeights),
    top5Weight: top5,
    top10Weight: top10,
    largestSector: sectorBreakdown[0]
      ? { label: sectorBreakdown[0].label, weight: sectorBreakdown[0].pct }
      : undefined,
    largestCountry: countryBreakdown[0]
      ? { label: countryBreakdown[0].label, weight: countryBreakdown[0].pct }
      : undefined,
    concentrationScore: concentrationScore(posWeights),
  };
}
