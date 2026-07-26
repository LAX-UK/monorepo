import { OnsiteEventForm } from "@/components/admin/event-rsvps/onsite-event-form";
import { loadAdminEventRsvpCreatePage } from "@/lib/admin/events/load-event-rsvp-create-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Create event",
  "Create a new invitation-only onsite event and link it to a saleroom sale.",
);

export default async function AdminCreateOnsiteEventPage() {
  const { saleroomSales } = await loadAdminEventRsvpCreatePage();
  return <OnsiteEventForm mode="create" saleroomSales={saleroomSales} />;
}
