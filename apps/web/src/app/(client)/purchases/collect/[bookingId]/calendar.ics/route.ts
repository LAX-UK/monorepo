import { fetchCalendarFile } from "@/lib/collect/collect-api.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { recordRefusalStatus } from "@/lib/http/record-refusal-status";
import { NextResponse } from "next/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The calendar file of one booked visit, as a download. It goes through the app so the person's
 * session and account travel with it; the file itself is the API's and holds no prices.
 */
export async function GET(_request: Request, context: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await context.params;
  if (!UUID.test(bookingId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const user = await (await getServerDataContainer()).session.getCurrent().catch(() => null);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await fetchCalendarFile(bookingId).catch(() => null);
  if (!res) return NextResponse.json({ error: "unavailable" }, { status: 502 });
  if (!res.ok) {
    // Someone else's booking reads exactly like a missing one.
    return NextResponse.json(
      { error: "not_available" },
      { status: recordRefusalStatus(res.status) },
    );
  }
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lax-collection.ics"',
      "Cache-Control": "no-store",
    },
  });
}
