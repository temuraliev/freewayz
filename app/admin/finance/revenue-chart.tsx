"use client";

import useSWR from "swr";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { fetcher } from "@frontend/lib/swr-fetcher";

interface DailyPoint {
  date: string;
  revenue: number;
  orderCount: number;
}

interface Response {
  days: number;
  data: DailyPoint[];
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function formatUzs(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function RevenueChart({ days = 30 }: { days?: number }) {
  const { data, isLoading } = useSWR<Response>(
    `/api/admin/finance/daily?days=${days}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading || !data) {
    return (
      <div className="h-60 w-full animate-pulse rounded-lg bg-secondary/40" />
    );
  }

  const totalRevenue = data.data.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = data.data.reduce((s, d) => s + d.orderCount, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Выручка за {days} дней
          </div>
          <div className="font-mono text-2xl font-bold text-foreground">
            {totalRevenue.toLocaleString()} UZS
          </div>
          <div className="text-xs text-muted-foreground">{totalOrders} заказов</div>
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "#888", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatUzs}
              tick={{ fill: "#888", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0a0a0a",
                border: "1px solid #27272a",
                borderRadius: 4,
                fontSize: 12,
              }}
              labelStyle={{ color: "#fff" }}
              formatter={(value: number, name: string) => {
                if (name === "revenue") return [`${value.toLocaleString()} UZS`, "Выручка"];
                return [value, name];
              }}
              labelFormatter={(label) => new Date(label).toLocaleDateString("ru-RU")}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
