// Historical stress tests: replay a past macro shock on the *current*
// portfolio weights. For each scenario we fetch each symbol's total return
// across the shock window; if a ticker didn't exist yet we substitute an
// asset-class proxy (SPY for equities, AGG for bonds, GLD for commodities).

import { historicalBetween } from "./market";

export type StressScenario = {
  key: string;
  name: string;
  description: string;
  from: Date;
  to: Date;
};

export const STRESS_SCENARIOS: StressScenario[] = [
  {
    key: "gfc_2008",
    name: "Global Financial Crisis",
    description: "S&P 500 peak (Oct 2007) to trough (Mar 2009). Lehman, systemic bank stress.",
    from: new Date("2007-10-09"),
    to: new Date("2009-03-09"),
  },
  {
    key: "covid_2020",
    name: "COVID crash",
    description: "Fastest bear market in history: Feb 19 – Mar 23 2020.",
    from: new Date("2020-02-19"),
    to: new Date("2020-03-23"),
  },
  {
    key: "rate_shock_2022",
    name: "2022 rate shock",
    description: "Hawkish Fed pivot, 60/40 annus horribilis. Jan – Oct 2022.",
    from: new Date("2022-01-03"),
    to: new Date("2022-10-14"),
  },
  {
    key: "dotcom_2000",
    name: "Dot-com bust",
    description: "Nasdaq peak (Mar 2000) to S&P trough (Oct 2002).",
    from: new Date("2000-03-10"),
    to: new Date("2002-10-09"),
  },
];

export type StressHolding = {
  symbol: string;
  weight: number; // 0..1
  assetType?: string | null;
  sector?: string | null;
};

export type StressResult = {
  scenario: StressScenario;
  portfolioReturn: number;
  portfolioValueChange: number; // absolute, given a starting value
  contributors: {
    symbol: string;
    weight: number;
    returnPct: number;
    contribution: number; // weight × return
    proxied: boolean;     // true if we used a proxy because ticker lacks history
  }[];
};

function classProxy(assetType?: string | null, sector?: string | null): string {
  if (assetType === "ETF" && (sector === "Long Treasuries" || sector === "Bonds")) return "AGG";
  if (assetType === "ETF" && sector === "Commodities") return "GLD";
  if (assetType === "ETF" && sector === "Emerging Markets") return "EEM";
  if (assetType === "CRYPTO") return "BTC-USD";
  return "SPY";
}

async function periodReturn(symbol: string, from: Date, to: Date): Promise<number | null> {
  const bars = await historicalBetween(symbol, from, to);
  if (bars.length < 2) return null;
  const first = bars[0].close;
  const last = bars[bars.length - 1].close;
  if (first <= 0) return null;
  return last / first - 1;
}

export async function runStressTest(
  scenario: StressScenario,
  holdings: StressHolding[],
  portfolioValue: number
): Promise<StressResult> {
  const contributors = await Promise.all(
    holdings.map(async (h) => {
      let ret = await periodReturn(h.symbol, scenario.from, scenario.to);
      let proxied = false;
      if (ret == null) {
        const proxy = classProxy(h.assetType, h.sector);
        ret = await periodReturn(proxy, scenario.from, scenario.to);
        proxied = true;
      }
      const r = ret ?? 0;
      return {
        symbol: h.symbol,
        weight: h.weight,
        returnPct: r,
        contribution: h.weight * r,
        proxied,
      };
    })
  );
  const portfolioReturn = contributors.reduce((s, c) => s + c.contribution, 0);
  return {
    scenario,
    portfolioReturn,
    portfolioValueChange: portfolioReturn * portfolioValue,
    contributors: contributors.sort((a, b) => a.contribution - b.contribution),
  };
}

export async function runAllStressTests(
  holdings: StressHolding[],
  portfolioValue: number
): Promise<StressResult[]> {
  return Promise.all(STRESS_SCENARIOS.map((s) => runStressTest(s, holdings, portfolioValue)));
}
