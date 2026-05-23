import { parseBidTab } from "@/components/dashboard/bid-board-rows";
import { BidsBoard } from "@/components/dashboard/bids-board";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { buildDashboardBidsBoardVm } from "@/lib/data/view-models/dashboard-bids.vm";

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string }>;
};

/** Loads bid data inside a parent `<Suspense>` so route `loading.tsx` can render. */
export async function BidsPageContent({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialTab = parseBidTab(sp.tab);
  const initialQ = (sp.q ?? "").trim().slice(0, 200);
  const now = Date.now();
  const container = await getServerDataContainer();
  let rows: Awaited<ReturnType<typeof container.bids.listMine>> = [];
  let loadFailure: DashboardSliceFailure | null = null;
  let sessionFailure: DashboardSliceFailure | null = null;
  let user: Awaited<ReturnType<typeof container.session.getCurrent>> = null;

  const settled = await Promise.allSettled([
    container.session.getCurrent(),
    container.bids.listMine(),
  ]);
  const [userResult, bidsResult] = settled;
  if (userResult.status === "fulfilled") {
    user = userResult.value;
  } else {
    sessionFailure = describeDashboardSliceFailure(
      userResult.reason,
      "session",
      "Could not load your session.",
    );
  }
  if (bidsResult.status === "fulfilled") {
    rows = bidsResult.value;
  } else {
    rows = [];
    loadFailure = describeDashboardSliceFailure(bidsResult.reason, "bids", "Could not load bids.");
  }

  const { active, won, lost } = buildDashboardBidsBoardVm(rows, user?.id, now);

  const artistIds = rows.map((r) => r.lot?.artistId ?? null);
  const artistNameById = await resolveArtistNames(artistIds);

  return (
    <BidsBoard
      loadFailure={loadFailure}
      sessionFailure={sessionFailure}
      active={active}
      won={won}
      lost={lost}
      initialTab={initialTab}
      initialQ={initialQ}
      artistNameById={artistNameById}
    />
  );
}
