import { Activity, Database } from "lucide-react";
import { getAlerts, getCashflow, getMetrics, getRecentTransactions } from "@/lib/cashflow";
import { SummaryCards } from "@/components/SummaryCards";
import { RunwayBanner } from "@/components/RunwayBanner";
import { AlertsPanel } from "@/components/AlertsPanel";
import { CashPositionChart } from "@/components/CashPositionChart";
import { CashBreakdownChart } from "@/components/CashBreakdownChart";
import { TransactionsTable } from "@/components/TransactionsTable";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatShortDate } from "@/lib/format";
import type {
  CashAlert,
  CashflowResponse,
  Metrics,
  TransactionDTO,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let metrics: Metrics;
  let cashflow: CashflowResponse;
  let alerts: CashAlert[];
  let transactions: TransactionDTO[];

  try {
    [metrics, cashflow, alerts, transactions] = await Promise.all([
      getMetrics(),
      getCashflow(),
      getAlerts(),
      getRecentTransactions(),
    ]);
  } catch (err) {
    return <SetupScreen error={err} />;
  }

  if (cashflow.cashPosition.length === 0 || transactions.length === 0) {
    return <SetupScreen empty />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-forecast">
            <Activity className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Cash Flow Analytics
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Forecasting &amp; Analytics Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            {metrics.months} months of history · 90-day forecast · latest data{" "}
            {cashflow.lastHistoricalDate ? formatShortDate(cashflow.lastHistoricalDate) : "—"}
          </p>
        </div>
        {cashflow.forecastModel && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-forecast" />
            model: <span className="font-mono text-foreground">{cashflow.forecastModel}</span>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-6">
        <SummaryCards metrics={metrics} />

        <RunwayBanner metrics={metrics} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Cash Position — Historical & 90-Day Forecast"
              subtitle="Actual balance blends into the projected trajectory"
              action={<ChartLegend />}
            />
            <CashPositionChart
              data={cashflow.cashPosition}
              lastHistoricalDate={cashflow.lastHistoricalDate}
              safetyThreshold={metrics.safetyThreshold}
            />
          </Card>

          <AlertsPanel alerts={alerts} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Inflows vs Outflows"
              subtitle="Month-over-month, last 12 months"
              action={<BreakdownLegend />}
            />
            <CashBreakdownChart data={cashflow.monthlyBreakdown} />
          </Card>

          <div className="lg:col-span-1">
            <TransactionsTable transactions={transactions} />
          </div>
        </div>
      </div>

      <footer className="mt-10 text-center text-xs text-muted">
        Synthetic data · Forecast engine: Python (NumPy/Pandas) · Next.js + Prisma + PostgreSQL
      </footer>
    </main>
  );
}

function ChartLegend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-inflow" /> Actual
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-forecast" /> Projected
      </span>
    </div>
  );
}

function BreakdownLegend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm bg-inflow" /> Inflow
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm bg-outflow" /> Outflow
      </span>
    </div>
  );
}

/** Friendly setup guidance shown when the DB is unreachable or unseeded. */
function SetupScreen({ error, empty }: { error?: unknown; empty?: boolean }) {
  const message = empty
    ? "The database is connected but has no transactions yet."
    : "Couldn't reach the PostgreSQL database.";
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl bg-forecast/10 p-4">
        <Database className="h-8 w-8 text-forecast" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold text-foreground">Finish the setup</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>

      <Card className="mt-6 w-full p-5 text-left">
        <ol className="list-decimal space-y-3 pl-5 text-sm text-muted">
          <li>
            Create the database:{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">
              createdb -U postgres cashflow
            </code>
          </li>
          <li>
            Set your real password in{" "}
            <code className="font-mono text-foreground">frontend/.env</code> (replace{" "}
            <code className="font-mono text-foreground">CHANGE_ME</code>).
          </li>
          <li>
            Apply the schema:{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">
              npx prisma migrate deploy
            </code>
          </li>
          <li>
            Seed &amp; forecast:{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">
              python analytics/generate_mock_data.py
            </code>{" "}
            then{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-foreground">
              python analytics/forecast.py
            </code>
          </li>
          <li>Refresh this page.</li>
        </ol>
      </Card>

      {error != null && (
        <p className="mt-4 max-w-lg break-words text-xs text-outflow/80">
          {error instanceof Error ? error.message : String(error)}
        </p>
      )}
    </main>
  );
}
