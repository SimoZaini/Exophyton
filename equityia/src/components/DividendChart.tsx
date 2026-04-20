"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type Point = { month: string; amount: number };

export function DividendChart({ data, currency = "USD" }: { data: Point[]; currency?: string }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.month + "-01").toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={formatted} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="divBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16c784" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#16c784" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2632" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#5a6478" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#5a6478"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v: number) => formatCurrency(v, currency, true)}
          />
          <Tooltip
            cursor={{ fill: "rgba(47,144,255,0.06)" }}
            contentStyle={{ background: "#151a23", border: "1px solid #1f2632", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8a94a6" }}
            formatter={(v: number) => formatCurrency(v, currency)}
          />
          <Bar dataKey="amount" fill="url(#divBar)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
