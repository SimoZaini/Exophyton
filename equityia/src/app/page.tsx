import Link from "next/link";
import { ArrowRight, BarChart3, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/register" className="btn-primary">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <main className="px-6 md:px-10">
        <section className="max-w-6xl mx-auto pt-16 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-bg-border bg-bg-elevated px-3 py-1 text-xs text-fg-muted mb-6">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            Institutional-grade analytics, for everyone
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight max-w-4xl mx-auto">
            Your portfolio, <span className="text-brand-400">decoded</span>.
          </h1>
          <p className="mt-5 text-lg text-fg-muted max-w-2xl mx-auto">
            EquityIA unifies tracking, risk analytics and allocation intelligence in one cockpit.
            Inspired by the tools used on Wall Street — built for modern investors.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/register" className="btn-primary">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="btn-outline">Sign in</Link>
          </div>
        </section>

        <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4 pb-24">
          <Feature
            icon={<TrendingUp className="h-5 w-5" />}
            title="Real-time tracking"
            desc="Live market prices, historical performance vs. benchmarks, dividend tracking."
          />
          <Feature
            icon={<BarChart3 className="h-5 w-5" />}
            title="Risk intelligence"
            desc="Sharpe, Sortino, VaR 95, CVaR, max drawdown, beta vs. S&P 500 — computed daily."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Allocation clarity"
            desc="Asset-class and sector breakdowns, concentration alerts, rebalancing insights."
          />
        </section>
      </main>

      <footer className="border-t border-bg-border px-6 md:px-10 py-6 text-xs text-fg-subtle flex items-center justify-between">
        <span>© {new Date().getFullYear()} EquityIA</span>
        <span>For research & educational purposes. Not investment advice.</span>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card-pad">
      <div className="h-9 w-9 rounded-lg bg-brand-600/15 text-brand-300 grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-fg-muted mt-1">{desc}</p>
    </div>
  );
}
