"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Activity, ArrowLeftRight, BarChart3, Briefcase, Coins, Globe2, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolios", label: "Portfolios", icon: Briefcase },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dividends", label: "Dividends", icon: Coins },
  { href: "/diversification", label: "Diversification", icon: Globe2 },
  { href: "/analytics", label: "Risk & Analytics", icon: BarChart3 },
  { href: "/market", label: "Market", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-bg-border bg-bg-elevated/60 backdrop-blur">
      <div className="px-5 py-5 border-b border-bg-border">
        <Logo />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-brand-600/15 text-brand-300 border border-brand-600/30"
                  : "text-fg-muted hover:text-fg hover:bg-bg-hover"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-bg-border">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-bg-hover"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
