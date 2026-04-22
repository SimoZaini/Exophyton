"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Bucket = { bucket: number; count: number; pct: number };

export function VaRHistogram({
  data,
  var95Return,
  var99Return,
}: {
  data: Bucket[];
  var95Return: number; // e.g. -0.08 means 8% loss
  var99Return: number;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f2632" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bucket"
            stroke="#5a6478"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v * 100).toFixed(0) + "%"}
          />
          <YAxis
            stroke="#5a6478"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "rgba(47,144,255,0.06)" }}
            contentStyle={{ background: "#151a23", border: "1px solid #1f2632", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8a94a6" }}
            formatter={(v: number) => [v.toLocaleString(), "Simulations"]}
            labelFormatter={(v: number) => `Return ${(v * 100).toFixed(1)}%`}
          />
          <ReferenceLine x={var95Return} stroke="#ff7a00" strokeDasharray="4 2" label={{ value: "VaR 95%", position: "top", fill: "#ff7a00", fontSize: 10 }} />
          <ReferenceLine x={var99Return} stroke="#ea3943" strokeDasharray="4 2" label={{ value: "VaR 99%", position: "top", fill: "#ea3943", fontSize: 10 }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.bucket < var95Return ? "#ea3943" : d.bucket < 0 ? "#ff7a00" : "#2f90ff"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
