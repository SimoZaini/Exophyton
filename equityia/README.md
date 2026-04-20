# EquityIA

Institutional-grade portfolio tracking & risk analytics, inspired by Moning / Invest.co
(retail UX) and Aladdin (risk & analytics).

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Prisma** + **SQLite** (swap to Postgres for prod)
- **NextAuth** (credentials)
- **yahoo-finance2** for quotes, history, symbol search
- **Recharts** for perf chart & allocation donuts
- Pure-TS analytics: Sharpe, Sortino, VaR/CVaR, max drawdown, beta vs. SPY

## Getting started

```bash
cd equityia
cp .env.example .env    # edit NEXTAUTH_SECRET for prod
npm install
npm run db:push         # create SQLite schema
npm run db:seed         # creates demo@equityia.app / demo1234 with a seeded portfolio
npm run dev             # http://localhost:3000
```

### Demo credentials

- email: `demo@equityia.app`
- password: `demo1234`

## What's included (Phase 1 MVP)

- Landing page + auth (sign up / sign in)
- Dashboard with KPIs, performance chart vs. S&P 500, risk metrics,
  allocation donuts (asset class & sector), and holdings table
- Portfolios CRUD + per-portfolio detail page
- Add / remove positions with live symbol search (yahoo-finance2)
- Consolidated **Allocation** view across portfolios
- **Risk & Analytics** table: Sharpe, Sortino, VaR 95, CVaR 95, max DD, beta
- Market watchlist page

## Roadmap (next phases)

- Dividends & cash flow tracking, dividend calendar
- CSV import from Degiro / IBKR / Trade Republic
- Factor attribution (Fama-French), stress tests, VaR Monte Carlo
- Portfolio optimization (Markowitz / risk-parity) recommendations
- Multi-currency FX conversion
