"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";

const COLORS = ["#2f90ff", "#16c784", "#f7b32b", "#ea3943", "#a855f7", "#14b8a6", "#f97316", "#6366f1", "#ec4899", "#64748b"];

export function AllocationDonut({
  data,
  currency = "USD",
}: {
  data: { label: string; value: number; pct: number }[];
  currency?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-fg-muted text-sm">
        No allocation data
      </div>
    );
  }
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Tooltip
              contentStyle={{
                background: "#151a23",
                border: "1px solid #1f2632",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number, _n, p) => [
                `${formatCurrency(v, currency)} (${formatPercent((p?.payload as { pct: number }).pct, 1)})`,
                (p?.payload as { label: string }).label,
              ]}
            />
            <Pie
              data={data}
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] uppercase tracking-wider text-fg-subtle">Total</div>
          <div className="text-sm font-semibold">{formatCurrency(total, currency, true)}</div>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm min-w-0">
        {data.slice(0, 6).map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="truncate text-fg-muted">{d.label}</span>
            <span className="ml-auto tabular-nums text-fg">{formatPercent(d.pct, 1)}</span>
          </li>
        ))}
        {data.length > 6 && <li className="text-xs text-fg-subtle">+{data.length - 6} more</li>}
      </ul>
    </div>
  );
}
