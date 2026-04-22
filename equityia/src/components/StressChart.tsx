"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";

type Point = { name: string; returnPct: number; pnl: number };

export function StressChart({ data, currency = "USD" }: { data: Point[]; currency?: string }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 40, left: 100, bottom: 0 }}
        >
          <CartesianGrid stroke="#1f2632" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke="#5a6478"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v * 100).toFixed(0) + "%"}
          />
          <YAxis
            dataKey="name"
            type="category"
            stroke="#a0a9bc"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            cursor={{ fill: "rgba(47,144,255,0.06)" }}
            contentStyle={{ background: "#151a23", border: "1px solid #1f2632", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8a94a6" }}
            formatter={(_v, _name, item) => {
              const p = (item as { payload?: Point }).payload;
              if (!p) return ["—", "Impact"];
              return [`${formatPercent(p.returnPct, 1)} · ${formatCurrency(p.pnl, currency)}`, "Impact"];
            }}
          />
          <Bar dataKey="returnPct" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.returnPct >= 0 ? "#16c784" : "#ea3943"} />
            ))}
            <LabelList
              dataKey="returnPct"
              position="right"
              fill="#a0a9bc"
              fontSize={11}
              formatter={(v: number) => formatPercent(v, 1)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
