import { getMetrics } from "@/lib/cashflow";

// Always reflect the latest database state; never cache.
export const dynamic = "force-dynamic";

/** GET /api/metrics — headline metrics: inflow/outflow totals, burn, runway. */
export async function GET() {
  try {
    const metrics = await getMetrics();
    return Response.json(metrics);
  } catch (err) {
    console.error("[/api/metrics]", err);
    return Response.json(
      { error: "Failed to compute metrics. Is the database seeded and reachable?" },
      { status: 500 },
    );
  }
}
