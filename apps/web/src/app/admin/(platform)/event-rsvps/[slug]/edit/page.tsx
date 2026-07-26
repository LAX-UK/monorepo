import { OnsiteEventForm } from "@/components/admin/event-rsvps/onsite-event-form";
import { OperationsDetailShell } from "@/components/admin/operations-detail-shell";
import { loadAdminEventRsvpEditPage } from "@/lib/admin/events/load-event-rsvp-edit-page";
import { getAdminOnsiteEventDetail } from "@/lib/data/http/onsite-event.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getAdminOnsiteEventDetail(slug).catch(() => null);
  return metadataForPrivate(detail?.title ?? slug, "Edit invitation-only onsite event settings.");
}

export default async function AdminEditOnsiteEventPage({ params }: Props) {
  const { slug } = await params;
  const model = await loadAdminEventRsvpEditPage({ slug });
  if (model.notFound || !model.detail) notFound();

  return (
    <OperationsDetailShell
      slug={slug}
      title={model.detail.title}
      description="Edit segments, schedule, and linked sale."
      eyebrow="Edit event"
    >
      <OnsiteEventForm mode="edit" initial={model.detail} saleroomSales={model.saleroomSales} />
    </OperationsDetailShell>
  );
}
