import { ArrowDownRight, ArrowUpRight, Landmark, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";
import type { Metrics } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent: "neutral" | "inflow" | "outflow" | "forecast";
}

const ACCENT: Record<StatProps["accent"], string> = {
  neutral: "text-foreground",
  inflow: "text-inflow",
  outflow: "text-outflow",
  forecast: "text-forecast",
};

const ICON_BG: Record<StatProps["accent"], string> = {
  neutral: "bg-slate-500/10 text-slate-300",
  inflow: "bg-inflow/10 text-inflow",
  outflow: "bg-outflow/10 text-outflow",
  forecast: "bg-forecast/10 text-forecast",
};

function Stat({ label, value, sublabel, icon, accent }: StatProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
        <span className={cn("rounded-lg p-2", ICON_BG[accent])}>{icon}</span>
      </div>
      <div className={cn("mt-3 text-3xl font-semibold tabular", ACCENT[accent])}>{value}</div>
      <p className="mt-1 text-xs text-muted">{sublabel}</p>
    </Card>
  );
}

export function SummaryCards({ metrics }: { metrics: Metrics }) {
  const projectionDelta = metrics.projected90DayBalance - metrics.currentCash;
  const projectionUp = projectionDelta >= 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Current Cash Balance"
        value={formatCurrency(metrics.currentCash)}
        sublabel="As of latest reconciliation"
        icon={<Landmark className="h-4 w-4" />}
        accent="neutral"
      />
      <Stat
        label="Projected 90-Day Balance"
        value={formatCurrency(metrics.projected90DayBalance)}
        sublabel={`${projectionUp ? "▲" : "▼"} ${formatCurrency(Math.abs(projectionDelta))} vs today`}
        icon={<TrendingUp className="h-4 w-4" />}
        accent={projectionUp ? "forecast" : "outflow"}
      />
      <Stat
        label="Avg Monthly Inflow"
        value={formatCurrency(metrics.avgMonthlyInflow)}
        sublabel={`Across ${metrics.months} months`}
        icon={<ArrowUpRight className="h-4 w-4" />}
        accent="inflow"
      />
      <Stat
        label="Avg Monthly Outflow"
        value={formatCurrency(metrics.avgMonthlyOutflow)}
        sublabel={`Across ${metrics.months} months`}
        icon={<ArrowDownRight className="h-4 w-4" />}
        accent="outflow"
      />
    </div>
  );
}
