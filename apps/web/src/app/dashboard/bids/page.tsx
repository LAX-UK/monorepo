import { parseBidTab } from "@/components/dashboard/bid-board-rows";
import { BidsBoard } from "@/components/dashboard/bids-board";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { buildDashboardBidsBoardVm } from "@/lib/data/view-models/dashboard-bids.vm";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Suspense } from "react";

type PageProps = {
  searchParams: Promise<{ tab?: string; q?: string }>;
};

export default async function DashboardBidsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialTab = parseBidTab(sp.tab);
  const initialQ = (sp.q ?? "").trim().slice(0, 200);
  const now = Date.now();
  const container = await getServerDataContainer();
  let rows: Awaited<ReturnType<typeof container.bids.listMine>> = [];
  let fetchError: string | null = null;
  let user: Awaited<ReturnType<typeof container.session.getCurrent>> = null;

  const settled = await Promise.allSettled([
    container.session.getCurrent(),
    container.bids.listMine(),
  ]);
  const [userResult, bidsResult] = settled;
  if (userResult.status === "fulfilled") {
    user = userResult.value;
  }
  if (bidsResult.status === "fulfilled") {
    rows = bidsResult.value;
  } else {
    rows = [];
    fetchError =
      bidsResult.reason instanceof Error ? bidsResult.reason.message : "Could not load bids.";
  }

  const { active, won, lost } = buildDashboardBidsBoardVm(rows, user?.id, now);

  const artistIds = rows.map((r) => r.lot?.artistId ?? null);
  const artistNameById = await resolveArtistNames(artistIds);

  return (
    <DashboardPage>
      <Suspense
        fallback={
          <PageSkeleton variant="table" className="max-w-[var(--container-inner,1376px)]" />
        }
      >
        <BidsBoard
          fetchError={fetchError}
          active={active}
          won={won}
          lost={lost}
          initialTab={initialTab}
          initialQ={initialQ}
          artistNameById={artistNameById}
        />
      </Suspense>
    </DashboardPage>
  );
}
