import { getAlerts } from "@/lib/cashflow";

export const dynamic = "force-dynamic";

/** GET /api/alerts — threshold breaches, runway warnings and flow anomalies. */
export async function GET() {
  try {
    const alerts = await getAlerts();
    return Response.json({ alerts });
  } catch (err) {
    console.error("[/api/alerts]", err);
    return Response.json(
      { error: "Failed to compute alerts. Is the database seeded and reachable?" },
      { status: 500 },
    );
  }
}
