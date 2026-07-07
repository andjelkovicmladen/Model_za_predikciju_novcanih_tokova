"use client";

import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CashPositionPoint } from "@/lib/types";
import { formatCompactCurrency, formatCurrency, formatMonthYear, formatShortDate } from "@/lib/format";

interface Props {
  data: CashPositionPoint[];
  lastHistoricalDate: string;
  safetyThreshold: number;
}

interface TooltipEntry {
  dataKey: string;
  value: number | null;
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length || !label) return null;
  const point = payload.find((p) => p.value !== null && p.value !== undefined);
  if (!point) return null;
  const isForecast = point.dataKey === "forecastBalance";
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 shadow-xl">
      <div className="text-xs text-muted">{formatShortDate(label)}</div>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: isForecast ? "var(--forecast)" : "var(--inflow)" }}
        />
        <span className="text-sm font-semibold tabular text-foreground">
          {formatCurrency(point.value as number)}
        </span>
        <span className="text-[11px] text-muted">{isForecast ? "projected" : "actual"}</span>
      </div>
    </div>
  );
}

export function CashPositionChart({ data, lastHistoricalDate, safetyThreshold }: Props) {
  const tickInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="h-80 w-full px-2 pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--inflow)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--inflow)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonthYear}
            interval={tickInterval}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={formatCompactCurrency}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip content={<ChartTooltip />} />

          <ReferenceLine
            y={safetyThreshold}
            stroke="var(--outflow)"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            label={{
              value: `Safety ${formatCompactCurrency(safetyThreshold)}`,
              position: "insideBottomLeft",
              fill: "var(--outflow)",
              fontSize: 11,
            }}
          />
          <ReferenceLine
            x={lastHistoricalDate}
            stroke="var(--muted)"
            strokeDasharray="2 4"
            label={{ value: "Today", position: "top", fill: "var(--muted)", fontSize: 11 }}
          />

          <Area
            type="monotone"
            dataKey="historicalBalance"
            name="Actual"
            stroke="var(--inflow)"
            strokeWidth={2}
            fill="url(#histFill)"
            connectNulls={false}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="forecastBalance"
            name="Projected"
            stroke="var(--forecast)"
            strokeWidth={2}
            strokeDasharray="6 5"
            connectNulls={false}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
