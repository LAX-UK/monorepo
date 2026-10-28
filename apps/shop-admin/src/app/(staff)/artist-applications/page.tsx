import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtistApplicationsList } from "@/components/artist-applications/artist-applications-list.client";
import { adminListPath } from "@/server/application/admin-list-path";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import {
  artistApplicationsList,
  parseArtistApplicationsState,
} from "@/server/domain/artist-application.vm";
import type {
  AdminArtistApplicationListResponse,
  AdminArtistApplicationReviewersResponse,
} from "@auction/shop-contracts";
import { redirect } from "next/navigation";

export const metadata = { title: "Artist applications" };

const EMPTY: AdminArtistApplicationListResponse = {
  items: [],
  nextCursor: null,
  counts: { all: 0, new: 0, in_review: 0, waiting: 0, decided: 0 },
};

export default async function ArtistApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseArtistApplicationsState(await searchParams);
  const [result, session, reviewers] = await Promise.all([
    fetchAdminJson<AdminArtistApplicationListResponse>(
      adminListPath("artist-applications", {
        cursor: state.cursor,
        query: artistApplicationsList.apiQuery(state),
      }),
    ),
    loadAdminSession(),
    fetchAdminJson<AdminArtistApplicationReviewersResponse>("artist-applications/reviewers"),
  ]);
  if (result.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (result.status === "forbidden" || result.status === "not_found") {
    return <AdminFailedPage title="Artist applications" status={result.status} />;
  }
  if (session.status !== "ok")
    return <AdminFailedPage title="Artist applications" status="failed" />;

  return (
    <ArtistApplicationsList
      state={state}
      page={result.status === "ok" ? result.data : EMPTY}
      loadFailed={result.status === "failed"}
      currentSubject={session.data.subject}
      reviewers={reviewers.status === "ok" ? reviewers.data.items : []}
    />
  );
}
