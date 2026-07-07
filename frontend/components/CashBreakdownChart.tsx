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
import type { MonthlyBreakdownPoint } from "@/lib/types";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
}

function BreakdownTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const inflow = payload.find((p) => p.dataKey === "inflow")?.value ?? 0;
  const outflow = payload.find((p) => p.dataKey === "outflow")?.value ?? 0;
  const net = inflow - outflow;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 shadow-xl">
      <div className="mb-1 text-xs text-muted">{label}</div>
      <Row color="var(--inflow)" label="Inflow" value={inflow} />
      <Row color="var(--outflow)" label="Outflow" value={outflow} />
      <div className="mt-1 border-t border-border pt-1">
        <Row color={net >= 0 ? "var(--inflow)" : "var(--outflow)"} label="Net" value={net} />
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-6 text-xs">
      <span className="flex items-center gap-1.5 text-muted">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular font-medium text-foreground">{formatCurrency(value)}</span>
    </div>
  );
}

export function CashBreakdownChart({ data }: { data: MonthlyBreakdownPoint[] }) {
  return (
    <div className="h-72 w-full px-2 pb-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 4 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tickFormatter={formatCompactCurrency}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip cursor={{ fill: "rgba(148,163,184,0.06)" }} content={<BreakdownTooltip />} />
          <Bar dataKey="inflow" name="Inflow" fill="var(--inflow)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar dataKey="outflow" name="Outflow" fill="var(--outflow)" radius={[3, 3, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
