import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { OnsiteEventAdminPanel } from "@/components/admin/onsite-events/onsite-event-admin-panel";
import { OnsiteEventRefreshOnReturn } from "@/components/admin/onsite-events/onsite-event-refresh-on-return";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import {
  getAdminOnsiteEventDetail,
  getAdminOnsiteEventRsvps,
} from "@/lib/data/http/onsite-event.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getAdminOnsiteEventDetail(slug).catch(() => null);
  const title = detail?.title ?? slug;
  return metadataForPrivate(title, "RSVPs for this onsite event.");
}

export default async function AdminOnsiteEventPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);

  let detail: Awaited<ReturnType<typeof getAdminOnsiteEventDetail>> = null;
  let rsvps: Awaited<ReturnType<typeof getAdminOnsiteEventRsvps>> = [];
  let loadError: string | null = null;

  try {
    detail = await getAdminOnsiteEventDetail(slug);
    if (!detail) notFound();
    try {
      rsvps = await getAdminOnsiteEventRsvps(slug);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Could not load RSVPs.";
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load onsite event data.";
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
          {slug}
        </h1>
        <AdminListAlert>{loadError ?? "Could not load onsite event data."}</AdminListAlert>
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <OnsiteEventRefreshOnReturn />
      </Suspense>
      <OnsiteEventAdminPanel
        slug={slug}
        title={detail.title}
        segmentOptions={detail.segmentOptions}
        micrositeUrl={detail.micrositeUrl}
        rsvps={rsvps}
        error={error ?? loadError}
      />
    </>
  );
}
