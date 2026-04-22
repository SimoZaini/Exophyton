# EquityIA — Project Memory

Context note for Claude Code sessions working on the EquityIA app.

## Repository layout
- Repo: `SimoZaini/Exophyton`
- Working branch: **`claude/setup-dev-environment-OdMbY`** (never push elsewhere)
- App lives in **`equityia/`** subdirectory (Next.js 14 / TS / Tailwind / Prisma / SQLite)
- Legacy `main.py` at repo root is unrelated (student exercise) — ignore

## Product
EquityIA = portfolio tracking platform. UX inspired by Moning/Invest.co,
analytics layer inspired by BlackRock Aladdin. Target: retail investors who
want institutional-grade risk + diversification + income dashboards.

## Stack & key libs
- Next.js 14 App Router, React 18, Tailwind (dark theme, custom tokens in
  `tailwind.config.ts` and `globals.css`)
- Prisma 5 + SQLite (`prisma/dev.db`, gitignored)
- NextAuth credentials provider (see `src/lib/auth.ts`)
- `yahoo-finance2@2.13.3` — pinned; **2.14+ strips modules we need**
- Recharts for charts; `lucide-react` icons; `clsx` + `tailwind-merge`

## What's shipped
### Phase 1 (commit 12ccbc6)
Auth, portfolios CRUD, positions CRUD with ticker search, live quotes,
dashboard, perf chart vs SPY, risk metrics page (Sharpe/Sortino/VaR/CVaR/
maxDD/β), market watchlist, seed `demo@equityia.app` / `demo1234`.

### Phase 4 (current commit — Aladdin-style analytics)
- `src/lib/linalg.ts` — tiny pure-TS linear algebra: transpose, multiply,
  inverse (Gauss-Jordan), Cholesky, covariance matrix, OLS with t-stats /
  R² / adj R² / residual std, MVN sampling, percentile
- `src/lib/factors.ts` — Fama-French 3-factor model built from liquid ETF
  proxies (MKT = SPY−rf, SMB = IWM−SPY, HML = IWD−IWF; optional QMJ). No
  dependency on Kenneth French's data library — reuses the yahoo pipeline.
  `runFactorRegression()` returns alpha (daily + annualized), β_MKT, β_SMB,
  β_HML, t-stats, R², idio vol.
- `src/lib/stress.ts` — historical stress tests: GFC 2008 (Oct '07→Mar '09),
  COVID crash (Feb→Mar 2020), 2022 rate shock (Jan→Oct '22), Dot-com bust
  (2000→2002). Missing ticker history proxied by SPY/AGG/GLD/EEM by asset
  class. Returns per-scenario portfolio return + contributors.
- `src/lib/montecarlo.ts` — MC VaR: Cholesky of daily covariance matrix,
  MVN sampling, compound across horizon (default 21 days), 10k sims,
  histogram + VaR95/99 + CVaR95/99 + best/worst 1%.
- `src/lib/optimizer.ts` — Markowitz long-only: projected-gradient descent
  with simplex projection (Duchi 2008). Solves min-variance and max-Sharpe
  (rf=4%). Returns weights, expected return/vol/Sharpe, and suggested
  trades in $ (Δweight × portfolioValue) vs current weights.
- `src/lib/analytics.ts` — added `alignedReturnsMatrix()` helper (dates ×
  symbols matrix from per-symbol price series).
- `src/lib/market.ts` — `cachedHistorical` now falls back to `PriceSnapshot`
  when yahoo fails (useful in rate-limited sandboxes + for historical stress
  windows that predate any live session). Added `historicalBetween(symbol,
  from, to)` for arbitrary date windows (needed by stress tests).
- `/analytics` page revamped: 4 sections (factor exposures table, stress
  chart with 4 scenarios, MC VaR histogram + stats, optimizer comparison
  table). All sections have graceful empty-state fallbacks. Original
  all-portfolios risk table kept at the bottom.
- `src/components/StressChart.tsx` + `VaRHistogram.tsx` — Recharts client
  components.

### Phase 3 (transactions + CSV import + dividend receipts)
- `src/lib/transactions.ts` — `applyTransaction()` (BUY/SELL update Position
  qty + weighted avgCost), `revertTransaction()`, `parseTransactionsCsv()`
  (simple header-based CSV: date,symbol,type,quantity,price,fees,currency,note),
  `dividendsReceivedBetween()`
- API routes:
  - `POST/GET /api/portfolios/[id]/transactions`
  - `DELETE /api/transactions/[id]` (reverts position effect)
  - `POST /api/portfolios/[id]/transactions/import` (CSV body)
  - `POST /api/dividends/receive` (logs DIVIDEND tx; resolves portfolio
    automatically from position if omitted)
- `/transactions` page — KPI cards (invested / sold / dividends logged / fees),
  filters (type / portfolio / symbol), add modal, CSV import modal with
  success/failure report, delete per row
- Dividends page: **Received YTD** KPI + per-symbol "Log" button opens modal
  that pre-fills one expected payment (`forwardAnnualIncome / frequency`)
- Sidebar: Transactions nav entry added (between Portfolios and Dividends)
- **Tax/FIFO lot accounting intentionally skipped** per user request
  ("faire l'impasse sur les impôts"). avgCost is weighted-average only.

### Phase 2 (dividends + diversification)
- `SymbolProfile` + `DividendEvent` models (`prisma/schema.prisma`)
- `src/lib/fundamentals.ts` — fetch + cache company profile + dividend
  history via `quoteSummary` / `historical`; retry/backoff on 429; country
  → region mapper
- `src/lib/dividends.ts` — forward-income projection, monthly bar chart
  data, 12-mo upcoming calendar. Infers payout frequency (monthly/quarterly/
  semi/annual) from historical ex-div gaps
- `src/lib/diversification.ts` — Herfindahl HHI, effective N, top5/top10
  concentration, concentration score 0–100
- Extended `src/lib/portfolio.ts` with profile-enriched breakdowns
  (sector / industry / country / region) + `forwardAnnualIncome` +
  `portfolioYield`
- `/dividends` page (KPIs, 12-mo monthly projection bar, payers table,
  upcoming dividend calendar, yield on cost)
- `/diversification` page (sector/industry/country/region donuts, top-10
  holdings table, concentration alerts)
- Dashboard KPI swap: "Cost basis" → "Forward income"
- Sidebar nav updated (Dividends, Diversification added; Allocation
  page deleted as superseded)
- Position create route auto-calls `refreshProfile` (fire-and-forget)

### Demo seed (11 positions, "Core Allocation" portfolio)
AAPL, MSFT, NVDA, GOOG, AMZN, JPM, UNH, XOM, VWO, TLT, GLD.
Seed first tries Yahoo, falls back to hand-curated static profiles
(sector/industry/country/dividend/yield/frequency) — needed because this
sandbox is rate-limited by Yahoo. In production Yahoo will work.

## Known issues / rough edges
- **Yahoo rate limiting** in this sandbox — live quotes, history, profiles
  will all hit 429. `refreshProfile` has retry/backoff; seed falls back
  to static data. User-added positions in prod will be fine.
- `/market` page needs Yahoo; displays empty in sandbox
- FX not implemented — everything assumed USD
- No real dividend history (only projected events); would need to record
  `DividendEvent` rows for actual cash received
- Position `country` column on `Position` model still exists but is now
  superseded by `SymbolProfile.country`; harmless for now
- The `Breakdown` merge in `src/app/(app)/diversification/page.tsx` is
  correct but the code path is a bit contorted — could be cleaned up

## Roadmap (next sessions)
- Broker-specific CSV mappers (Degiro / IBKR / Trade Republic) on top of
  the generic importer
- **Phase 5 — multi-currency FX**, cash positions, benchmarks selector,
  portfolio compare
- Factor-model extensions: 5-factor (profitability + investment), rolling
  betas chart, risk decomposition (systematic vs idiosyncratic per holding)
- Optimizer extensions: efficient frontier curve, custom constraints
  (min/max per holding, sector caps), risk-parity, Black-Litterman
- Seed synthetic daily price history for all demo tickers so the
  /analytics page populates fully in sandboxed environments
- Mobile responsive polish (sidebar is hidden < md but no mobile nav yet)
- Swap SQLite → Postgres for production deploy

## Local dev quickstart
```bash
cd equityia
npm install
npm run db:push
npm run db:seed   # creates demo user + backfills profiles
npm run dev       # http://localhost:3000  — demo@equityia.app / demo1234
```

Login and visit `/dashboard`, `/dividends`, `/diversification`.
