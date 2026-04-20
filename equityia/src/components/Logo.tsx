import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 grid place-items-center shadow-card">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l5-5 4 4 7-8" />
          <path d="M14 8h5v5" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-base font-semibold tracking-tight">
            Equity<span className="text-brand-400">IA</span>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-fg-subtle">Portfolio Intelligence</div>
        </div>
      )}
    </div>
  );
}
