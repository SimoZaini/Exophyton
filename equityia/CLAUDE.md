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

### Phase 2 (current commit — dividends + diversification)
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
- **Phase 3 — transactions**: real dividend receipt logging, CSV import
  from Degiro / IBKR / Trade Republic, tax lots, FIFO cost-basis
- **Phase 4 — factor analytics** (real Aladdin feel): Fama-French 3/5 factor
  regression, stress tests (2008, 2020, rate-shock), Monte Carlo VaR,
  Markowitz / risk-parity optimization with rebalancing suggestions
- **Phase 5 — multi-currency FX**, cash positions, benchmarks selector,
  portfolio compare
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
