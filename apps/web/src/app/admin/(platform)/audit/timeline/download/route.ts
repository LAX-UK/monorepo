import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type NextRequest, NextResponse } from "next/server";

/** Cookie-authenticated proxy for aggregate-scoped domain event export (CSV/JSON). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const aggregateType = sp.get("aggregateType")?.trim();
  const aggregateId = sp.get("aggregateId")?.trim();
  const format = sp.get("format") === "csv" ? "csv" : "json";
  if (!aggregateType || !aggregateId) {
    return NextResponse.json(
      { error: "aggregateType and aggregateId query parameters are required" },
      { status: 400 },
    );
  }

  const qs = new URLSearchParams();
  qs.set("format", format);
  qs.set("aggregateType", aggregateType);
  qs.set("aggregateId", aggregateId);
  const limit = sp.get("limit")?.trim();
  if (limit) qs.set("limit", limit);
  // Do not forward includePii: exports via this Next route are always redacted; staff with
  // audit.read_pii should use the API or admin UI paths that enforce capability server-side.

  const res = await authedServerFetch(`/admin/audit/domain-events/export?${qs.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || "Export failed" }, { status: res.status });
  }

  if (format === "json") {
    return new NextResponse(res.body, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="domain-events-${aggregateType}.csv"`,
    },
  });
}
