import { chromium, type BrowserContext } from "playwright";

const PAGES = [
  { path: "/dashboard", file: "01-dashboard" },
  { path: "/transactions", file: "02-transactions" },
  { path: "/dividends", file: "03-dividends" },
  { path: "/diversification", file: "04-diversification" },
  { path: "/analytics", file: "05-analytics" },
  { path: "/portfolios", file: "06-portfolios" },
];

// Drive the NextAuth credentials flow directly via fetch, grab the session
// cookie, and inject it into the browser context. Much more reliable than
// automating the login form.
async function login(ctx: BrowserContext) {
  const base = "http://localhost:3000";

  // 1) CSRF token + cookie
  const csrfRes = await fetch(base + "/api/auth/csrf");
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  const csrfCookies = csrfRes.headers.getSetCookie();

  // 2) POST credentials, carrying the CSRF cookie
  const body = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    email: "demo@equityia.app",
    password: "demo1234",
    callbackUrl: base + "/dashboard",
    json: "true",
  });
  const cookieHeader = csrfCookies.map((c) => c.split(";")[0]).join("; ");
  const loginRes = await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: cookieHeader,
    },
    body,
    redirect: "manual",
  });
  const sessionCookies = loginRes.headers.getSetCookie();
  const all = [...csrfCookies, ...sessionCookies];
  console.log("login status", loginRes.status, "· got", sessionCookies.length, "new cookies");

  const parsed = all
    .map((raw) => raw.split(";")[0])
    .filter((c) => c.includes("="))
    .map((c) => {
      const eq = c.indexOf("=");
      return {
        name: c.slice(0, eq).trim(),
        value: c.slice(eq + 1).trim(),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      };
    });
  await ctx.addCookies(parsed);
  console.log("cookies set:", parsed.map((p) => p.name).join(", "));
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await login(ctx);

  const page = await ctx.newPage();
  // Sanity check: dashboard should render without redirect.
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  console.log("first nav →", page.url());

  for (const p of PAGES) {
    const url = "http://localhost:3000" + p.path;
    console.log("→", p.path);
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1200);
    const out = `/tmp/shots/${p.file}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log("   saved", out);
  }

  await browser.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
