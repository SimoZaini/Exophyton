# Deploying EquityIA to Vercel

Step-by-step, assuming a fresh Vercel account.

## 1. Push the repo to GitHub

If you haven't already:
```bash
# from the repo root (Exophyton/)
git push -u origin claude/setup-dev-environment-OdMbY
```

## 2. Import into Vercel

1. <https://vercel.com/new>
2. Select the `Exophyton` repository
3. **Root Directory** → click **Edit** → set to `equityia`
4. Framework Preset: **Next.js** (auto-detected)
5. Build command: leave as-is (it's overridden by `package.json` to run Prisma)
6. Click **Deploy** — it will **fail the first time** because no DB is attached yet. That's expected; continue to step 3.

## 3. Attach a Postgres database

1. In the Vercel project dashboard → **Storage** tab → **Create Database**
2. Choose **Neon** (recommended — free, 0.5 GB, auto-integration)
3. Click **Create & Attach**. Vercel will auto-inject these env vars:
   - `POSTGRES_PRISMA_URL` (pooled)
   - `POSTGRES_URL_NON_POOLING` (direct — needed for migrations)
   - `POSTGRES_URL`, `POSTGRES_USER`, etc. (we don't use these but they don't hurt)

## 4. Set the remaining environment variables

Settings → Environment Variables. Add to **Production, Preview, Development**:

| Name | Value | How to generate |
|------|-------|-----------------|
| `NEXTAUTH_SECRET` | long random string | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<your-project>.vercel.app` | after first successful deploy |
| `SEED_TOKEN` | long random string | `openssl rand -hex 32` |

> Tip: you can set `NEXTAUTH_URL` after the first deploy once Vercel assigns a URL. Without it, NextAuth falls back to `VERCEL_URL`, which works but issues callbacks on the ephemeral preview URL.

## 5. Redeploy

Dashboard → Deployments → the failed deploy → **Redeploy**.

Build log should show:
```
✔ Generated Prisma Client
🚀 Your database is now in sync with your Prisma schema
▲ Compiled successfully
```

App boots at `https://<your-project>.vercel.app`. Register a new account, or continue to step 6 to seed the demo data.

## 6. (Optional) Seed the demo data

With `SEED_TOKEN` set, the demo user (`demo@equityia.app` / `demo1234`) and the 11-position "Core Allocation" portfolio can be populated in one call:

```bash
curl -X POST https://<your-project>.vercel.app/api/admin/seed \
  -H "Authorization: Bearer $SEED_TOKEN"
```

Response:
```json
{
  "ok": true,
  "user": "demo@equityia.app",
  "portfolio": "Core Allocation",
  "positions": 11,
  "fundamentals": { "live": 11, "static": 0 },
  "transactions": { "buys": 13, "dividends": 10 },
  "receivedYtd": 216.09
}
```

The endpoint is idempotent — running it again keeps the same positions and rewrites transactions to the canonical demo set. It takes ~10–30 s because it pulls live fundamentals from Yahoo for each of the 11 tickers.

## 7. (Optional) Custom domain

Project → Settings → Domains → add your domain. Remember to update `NEXTAUTH_URL` to match.

---

## Local development against the deployed Postgres

```bash
cd equityia
cp .env.example .env
# Paste the POSTGRES_* values from Vercel > Settings > Environment Variables
# (click "Copy as .env" in the Storage integration panel)
npm install
npm run db:push
npm run db:seed
npm run dev
```

## Troubleshooting

- **`Error: P1001: Can't reach database server`** during build → `POSTGRES_URL_NON_POOLING` is missing. Neon integration should have set it; re-attach if needed.
- **`NEXTAUTH_URL` mismatch warning** → set it explicitly in Vercel env vars.
- **Analytics page times out** → Hobby plan caps serverless at 60 s; the `/analytics` page fetches 2 y of daily history for every holding plus 4 ETF proxies. Reduce `horizonDays`, `simulations`, or the `period` in the page source if needed.
