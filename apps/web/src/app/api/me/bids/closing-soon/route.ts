import { getServerDataContainer } from "@/lib/data/container.server";
import { buildDashboardBidsBoardVm } from "@/lib/data/view-models/dashboard-bids.vm";
import { NextResponse } from "next/server";

const CLOSING_SOON_MS = 24 * 60 * 60 * 1000;

/** Active bids on lots ending within 24 hours (for marketing header chip). */
export async function GET() {
  const c = await getServerDataContainer();
  const user = await c.session.getCurrent();
  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  try {
    const rows = await c.bids.listMine();
    const now = Date.now();
    const { active } = buildDashboardBidsBoardVm(rows, user.id, now);
    const count = active.filter((row) => {
      const end = row.lot?.endTime.getTime();
      if (!end) return false;
      return end > now && end <= now + CLOSING_SOON_MS;
    }).length;
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
