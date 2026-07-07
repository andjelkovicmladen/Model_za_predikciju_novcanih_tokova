import "server-only";

import { prisma } from "@/lib/prisma";
import { HORIZON_DAYS, RUNWAY_WARNING_MONTHS, SAFETY_THRESHOLD } from "@/lib/config";
import type {
  CashAlert,
  CashPositionPoint,
  CashflowResponse,
  Metrics,
  MonthlyBreakdownPoint,
  TransactionDTO,
} from "@/lib/types";

/* --------------------------------------------------------------------------
 * Raw row shapes returned from PostgreSQL. Numeric columns are cast to
 * ::float8 in SQL so they arrive as JS numbers (not Prisma Decimals), and
 * dates are cast to text to sidestep timezone off-by-one issues.
 * ------------------------------------------------------------------------ */
interface DailyRow { date: string; inflow: number; outflow: number }
interface MonthlyRow { month: string; inflow: number; outflow: number }
interface ForecastRow { date: string; inflow: number; outflow: number; balance: number; model: string }

async function fetchDaily(): Promise<DailyRow[]> {
  return prisma.$queryRaw<DailyRow[]>`
    SELECT to_char(date, 'YYYY-MM-DD')                                   AS date,
           SUM(CASE WHEN type = 'INFLOW'  THEN amount ELSE 0 END)::float8 AS inflow,
           SUM(CASE WHEN type = 'OUTFLOW' THEN amount ELSE 0 END)::float8 AS outflow
    FROM "transactions"
    GROUP BY date
    ORDER BY date ASC`;
}

async function fetchMonthly(): Promise<MonthlyRow[]> {
  return prisma.$queryRaw<MonthlyRow[]>`
    SELECT to_char(date_trunc('month', date), 'YYYY-MM')                 AS month,
           SUM(CASE WHEN type = 'INFLOW'  THEN amount ELSE 0 END)::float8 AS inflow,
           SUM(CASE WHEN type = 'OUTFLOW' THEN amount ELSE 0 END)::float8 AS outflow
    FROM "transactions"
    GROUP BY 1
    ORDER BY 1 ASC`;
}

async function fetchForecast(): Promise<ForecastRow[]> {
  return prisma.$queryRaw<ForecastRow[]>`
    SELECT to_char(date, 'YYYY-MM-DD')      AS date,
           "predictedInflow"::float8        AS inflow,
           "predictedOutflow"::float8       AS outflow,
           "predictedBalance"::float8       AS balance,
           model
    FROM "forecasted_data"
    ORDER BY date ASC`;
}

/** Latest transactions for the recent-activity table. */
export async function getRecentTransactions(limit = 12): Promise<TransactionDTO[]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; date: string; description: string; category: string; type: string; amount: number }>
  >`
    SELECT id,
           to_char(date, 'YYYY-MM-DD') AS date,
           description,
           category::text              AS category,
           type::text                  AS type,
           amount::float8              AS amount
    FROM "transactions"
    ORDER BY date DESC, "createdAt" DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    category: r.category as TransactionDTO["category"],
    type: r.type as TransactionDTO["type"],
    amount: r.amount,
  }));
}

/**
 * Derive today's cash balance from the forecast so the historical and
 * projected lines join exactly. The first forecast day satisfies
 *   balance₀ = currentCash + (inflow₀ − outflow₀)
 * so currentCash is recovered by subtracting that day's net.
 */
function deriveCurrentCash(forecast: ForecastRow[], daily: DailyRow[]): number {
  if (forecast.length > 0) {
    const f0 = forecast[0];
    return f0.balance - (f0.inflow - f0.outflow);
  }
  // Fallback (no forecast cached yet): assume a zero opening balance.
  return daily.reduce((acc, d) => acc + d.inflow - d.outflow, 0);
}

/** Reconstruct the historical balance line, anchored so it ends at currentCash. */
function buildHistoricalBalances(daily: DailyRow[], currentCash: number): number[] {
  const totalNet = daily.reduce((acc, d) => acc + d.inflow - d.outflow, 0);
  let cum = 0;
  return daily.map((d) => {
    cum += d.inflow - d.outflow;
    // balance = currentCash − (remaining net after this day)
    return currentCash - (totalNet - cum);
  });
}

/** Headline metrics for the summary cards and runway widget. */
export async function getMetrics(): Promise<Metrics> {
  const [monthly, forecast, daily] = await Promise.all([
    fetchMonthly(),
    fetchForecast(),
    fetchDaily(),
  ]);

  const totalInflow = monthly.reduce((a, m) => a + m.inflow, 0);
  const totalOutflow = monthly.reduce((a, m) => a + m.outflow, 0);
  const months = Math.max(monthly.length, 1);

  const avgMonthlyInflow = totalInflow / months;
  const avgMonthlyOutflow = totalOutflow / months;

  // Current burn from the most recent quarter (up to 3 full months).
  const recent = monthly.slice(-3);
  const recentAvgNet =
    recent.reduce((a, m) => a + (m.inflow - m.outflow), 0) / Math.max(recent.length, 1);
  const monthlyBurnRate = -recentAvgNet; // positive = burning cash

  const currentCash = deriveCurrentCash(forecast, daily);
  const projected90DayBalance =
    forecast.length > 0 ? forecast[forecast.length - 1].balance : currentCash;

  const runwayMonths = monthlyBurnRate > 0 ? currentCash / monthlyBurnRate : null;

  return {
    currentCash,
    projected90DayBalance,
    totalInflow,
    totalOutflow,
    avgMonthlyInflow,
    avgMonthlyOutflow,
    monthlyBurnRate,
    runwayMonths,
    safetyThreshold: SAFETY_THRESHOLD,
    months,
  };
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${mon} '${String(y).slice(2)}`;
}

/** Combined historical + forecast series for the charts. */
export async function getCashflow(): Promise<CashflowResponse> {
  const [daily, monthly, forecast] = await Promise.all([
    fetchDaily(),
    fetchMonthly(),
    fetchForecast(),
  ]);

  const currentCash = deriveCurrentCash(forecast, daily);
  const balances = buildHistoricalBalances(daily, currentCash);

  // Down-sample history to ~weekly points to keep the chart light and smooth,
  // always including the final historical day (the join point).
  const cashPosition: CashPositionPoint[] = [];
  const lastIdx = daily.length - 1;
  for (let i = 0; i < daily.length; i++) {
    if (i % 7 !== 0 && i !== lastIdx) continue;
    const isJoin = i === lastIdx;
    cashPosition.push({
      date: daily[i].date,
      historicalBalance: balances[i],
      // Seed the forecast line at the join point so it connects seamlessly.
      forecastBalance: isJoin ? currentCash : null,
    });
  }
  for (const f of forecast) {
    cashPosition.push({ date: f.date, historicalBalance: null, forecastBalance: f.balance });
  }

  const monthlyBreakdown: MonthlyBreakdownPoint[] = monthly.slice(-12).map((m) => ({
    month: m.month,
    label: formatMonthLabel(m.month),
    inflow: m.inflow,
    outflow: m.outflow,
    net: m.inflow - m.outflow,
  }));

  return {
    cashPosition,
    monthlyBreakdown,
    lastHistoricalDate: daily.length ? daily[lastIdx].date : "",
    forecastModel: forecast.length ? forecast[0].model : null,
  };
}

/** Detect a threshold breach, short runway, and statistical daily-flow anomalies. */
export async function getAlerts(): Promise<CashAlert[]> {
  const [daily, forecast, monthly] = await Promise.all([
    fetchDaily(),
    fetchForecast(),
    fetchMonthly(),
  ]);

  const alerts: CashAlert[] = [];
  const currency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  // 1) Projected balance dropping below the safety threshold.
  const breach = forecast.findIndex((f) => f.balance < SAFETY_THRESHOLD);
  if (breach !== -1) {
    const f = forecast[breach];
    alerts.push({
      id: "threshold-breach",
      level: "critical",
      title: "Cash safety threshold breach",
      message: `Projected cash balance drops below the ${currency(
        SAFETY_THRESHOLD,
      )} safety threshold on day ${breach + 1} (${f.date}), reaching ${currency(f.balance)}.`,
      day: breach + 1,
      date: f.date,
    });
  }

  // 2) Runway warning.
  const recent = monthly.slice(-3);
  const recentAvgNet =
    recent.reduce((a, m) => a + (m.inflow - m.outflow), 0) / Math.max(recent.length, 1);
  const burn = -recentAvgNet;
  const currentCash = deriveCurrentCash(forecast, daily);
  if (burn > 0) {
    const runway = currentCash / burn;
    if (runway < RUNWAY_WARNING_MONTHS) {
      alerts.push({
        id: "short-runway",
        level: "warning",
        title: "Limited cash runway",
        message: `At the current burn of ${currency(burn)}/mo, runway is ~${runway.toFixed(
          1,
        )} months. Consider tightening spend or raising capital.`,
      });
    }
  }

  // 3) Statistical anomaly in recent daily net cash flow (|z| > 3).
  const nets = daily.map((d) => d.inflow - d.outflow);
  if (nets.length > 30) {
    const mean = nets.reduce((a, n) => a + n, 0) / nets.length;
    const std = Math.sqrt(nets.reduce((a, n) => a + (n - mean) ** 2, 0) / nets.length) || 1;
    const window = daily.slice(-90);
    let extreme: { date: string; z: number; net: number } | null = null;
    window.forEach((d) => {
      const net = d.inflow - d.outflow;
      const z = (net - mean) / std;
      if (Math.abs(z) > 3 && (!extreme || Math.abs(z) > Math.abs(extreme.z))) {
        extreme = { date: d.date, z, net };
      }
    });
    if (extreme) {
      const e = extreme as { date: string; z: number; net: number };
      alerts.push({
        id: "flow-anomaly",
        level: "info",
        title: "Unusual daily cash movement",
        message: `${e.date} saw an atypical net movement of ${currency(e.net)} (${e.z.toFixed(
          1,
        )}σ from normal) — worth a quick reconciliation.`,
        date: e.date,
      });
    }
  }

  // 4) All clear.
  if (!alerts.some((a) => a.level === "critical" || a.level === "warning")) {
    alerts.unshift({
      id: "healthy",
      level: "info",
      title: "Cash position healthy",
      message: `Projected balance stays above the ${currency(
        SAFETY_THRESHOLD,
      )} safety threshold across the next ${HORIZON_DAYS} days.`,
    });
  }

  return alerts;
}
