import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtistApplicationRecord } from "@/components/artist-applications/artist-application-record.client";
import { fetchAdminJson, loadAdminSession } from "@/server/application/load-admin-data";
import { applicationTitle } from "@/server/domain/artist-application.vm";
import type {
  AdminArtistApplicationDetail,
  AdminArtistApplicationReviewersResponse,
} from "@auction/shop-contracts";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return { title: "Application" };
  const detail = await fetchAdminJson<AdminArtistApplicationDetail>(`artist-applications/${id}`);
  return { title: detail.status === "ok" ? applicationTitle(detail.data) : "Application" };
}

export default async function ArtistApplicationPage({ params }: Props) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const [detail, session, reviewers] = await Promise.all([
    fetchAdminJson<AdminArtistApplicationDetail>(`artist-applications/${id}`),
    loadAdminSession(),
    fetchAdminJson<AdminArtistApplicationReviewersResponse>("artist-applications/reviewers"),
  ]);
  if (detail.status === "unauthorized" || session.status === "unauthorized") redirect("/login");
  if (detail.status === "not_found") notFound();
  if (detail.status === "forbidden")
    return <AdminFailedPage title="Application" status="forbidden" />;
  if (detail.status !== "ok" || session.status !== "ok") {
    return <AdminFailedPage title="Application" status="failed" />;
  }

  return (
    <ArtistApplicationRecord
      detail={detail.data}
      reviewers={reviewers.status === "ok" ? reviewers.data.items : []}
      currentSubject={session.data.subject}
    />
  );
}
