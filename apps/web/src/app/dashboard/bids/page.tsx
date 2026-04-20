import { buildBidBoardRows } from "@/components/dashboard/bid-board-rows";
import { BidsBoard } from "@/components/dashboard/bids-board";
import { getServerMyBids } from "@/lib/data/http/dashboard.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";

export default async function DashboardBidsPage() {
  const user = await getServerSessionUser();
  const now = Date.now();
  let rows: Awaited<ReturnType<typeof getServerMyBids>> = [];
  let fetchError: string | null = null;
  try {
    rows = await getServerMyBids();
  } catch (e) {
    rows = [];
    fetchError = e instanceof Error ? e.message : "Could not load bids.";
  }

  const latestByLot = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    const prev = latestByLot.get(row.bid.lotId);
    if (!prev || row.bid.createdAt > prev.bid.createdAt) {
      latestByLot.set(row.bid.lotId, row);
    }
  }
  const unique = [...latestByLot.values()].sort((a, b) => {
    const ae = a.lot?.endTime.getTime() ?? 0;
    const be = b.lot?.endTime.getTime() ?? 0;
    return ae - be;
  });

  const { active, won, lost } = buildBidBoardRows(unique, user?.id, now);

  return <BidsBoard fetchError={fetchError} active={active} won={won} lost={lost} />;
}
