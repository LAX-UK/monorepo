import { OnsiteEventAdminPanel } from "@/components/admin/onsite-events/onsite-event-admin-panel";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import {
  getAdminOnsiteEventDetail,
  getAdminOnsiteEventRsvps,
} from "@/lib/data/http/onsite-event.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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
    rsvps = await getAdminOnsiteEventRsvps(slug);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load onsite event data.";
  }

  if (!detail) notFound();

  return (
    <OnsiteEventAdminPanel
      slug={slug}
      title={detail.title}
      segmentOptions={detail.segmentOptions}
      micrositeUrl={detail.micrositeUrl}
      rsvps={rsvps}
      error={error ?? loadError}
    />
  );
}
