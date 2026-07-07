import { AlertTriangle, Flame, ShieldCheck } from "lucide-react";
import { formatCurrency, formatRunway } from "@/lib/format";
import type { Metrics } from "@/lib/types";
import { RUNWAY_WARNING_MONTHS } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Prominent runway + burn-rate banner. Colour and icon escalate with risk:
 * healthy (cash-flow positive), caution (finite runway), critical (short runway).
 */
export function RunwayBanner({ metrics }: { metrics: Metrics }) {
  const { monthlyBurnRate, runwayMonths } = metrics;
  const burning = monthlyBurnRate > 0;

  const level: "healthy" | "caution" | "critical" = !burning
    ? "healthy"
    : runwayMonths !== null && runwayMonths < RUNWAY_WARNING_MONTHS
      ? "critical"
      : "caution";

  const theme = {
    healthy: {
      ring: "border-inflow/30 bg-inflow/5",
      icon: <ShieldCheck className="h-6 w-6 text-inflow" />,
      chip: "bg-inflow/15 text-inflow",
      headline: "Cash-flow positive",
    },
    caution: {
      ring: "border-forecast/30 bg-forecast/5",
      icon: <Flame className="h-6 w-6 text-forecast" />,
      chip: "bg-forecast/15 text-forecast",
      headline: "Burning cash — runway healthy",
    },
    critical: {
      ring: "border-outflow/40 bg-outflow/5",
      icon: <AlertTriangle className="h-6 w-6 text-outflow" />,
      chip: "bg-outflow/15 text-outflow",
      headline: "Burning cash — runway is short",
    },
  }[level];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border p-5 shadow-lg shadow-black/20 sm:flex-row sm:items-center sm:justify-between",
        theme.ring,
      )}
    >
      <div className="flex items-center gap-4">
        <div className="rounded-xl bg-black/20 p-3">{theme.icon}</div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Runway &amp; Burn Rate</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", theme.chip)}>
              {theme.headline}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-xs text-muted">
            {burning
              ? `Net burn of ${formatCurrency(monthlyBurnRate)} per month based on the last quarter. At this pace, current cash lasts the runway shown.`
              : `The business is accumulating cash (${formatCurrency(-monthlyBurnRate)} net inflow per month over the last quarter). No runway constraint.`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6 sm:gap-8">
        <Metric label="Monthly Burn" value={burning ? formatCurrency(monthlyBurnRate) : "—"} tone={burning ? "outflow" : "muted"} />
        <div className="h-10 w-px bg-border" />
        <Metric
          label="Runway"
          value={formatRunway(runwayMonths)}
          tone={level === "critical" ? "outflow" : level === "healthy" ? "inflow" : "foreground"}
        />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "inflow" | "outflow" | "foreground" | "muted";
}) {
  const color = {
    inflow: "text-inflow",
    outflow: "text-outflow",
    foreground: "text-foreground",
    muted: "text-muted",
  }[tone];
  return (
    <div className="text-right">
      <div className={cn("text-2xl font-semibold tabular", color)}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}
