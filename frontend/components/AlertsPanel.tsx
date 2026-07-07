import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import type { CashAlert } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVEL_STYLE = {
  critical: {
    icon: <AlertTriangle className="h-4 w-4 text-outflow" />,
    ring: "border-outflow/30 bg-outflow/5",
  },
  warning: {
    icon: <Bell className="h-4 w-4 text-amber-400" />,
    ring: "border-amber-400/30 bg-amber-400/5",
  },
  info: {
    icon: <Info className="h-4 w-4 text-forecast" />,
    ring: "border-forecast/20 bg-forecast/5",
  },
} as const;

export function AlertsPanel({ alerts }: { alerts: CashAlert[] }) {
  const healthy = alerts.every((a) => a.level === "info");
  return (
    <Card className="flex h-full flex-col pb-5">
      <CardHeader
        title="Alerts & Anomalies"
        subtitle="Threshold breaches, runway risk and unusual movements"
        action={
          healthy ? (
            <CheckCircle2 className="h-5 w-5 text-inflow" />
          ) : (
            <span className="rounded-full bg-outflow/15 px-2 py-0.5 text-[11px] font-medium text-outflow">
              Action needed
            </span>
          )
        }
      />
      <div className="mt-4 flex flex-col gap-3 px-5">
        {alerts.map((a) => {
          const style = LEVEL_STYLE[a.level];
          return (
            <div key={a.id} className={cn("flex gap-3 rounded-xl border p-3", style.ring)}>
              <div className="mt-0.5">{style.icon}</div>
              <div>
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{a.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
