"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type Point = { date: string; value: number; benchmark?: number };

export function PerfChart({ data, currency = "USD" }: { data: Point[]; currency?: string }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f90ff" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#2f90ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8a94a6" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#8a94a6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2632" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#5a6478"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            stroke="#5a6478"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={70}
            tickFormatter={(v: number) => formatCurrency(v, currency, true)}
          />
          <Tooltip
            contentStyle={{
              background: "#151a23",
              border: "1px solid #1f2632",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#8a94a6" }}
            formatter={(v: number) => formatCurrency(v, currency)}
          />
          {data[0]?.benchmark != null && (
            <Area
              type="monotone"
              dataKey="benchmark"
              stroke="#8a94a6"
              strokeWidth={1.5}
              fill="url(#benchGrad)"
              strokeDasharray="4 4"
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#2f90ff"
            strokeWidth={2}
            fill="url(#portfolioGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
