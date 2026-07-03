import { OnsiteEventForm } from "@/components/admin/event-rsvps/onsite-event-form";
import { loadSaleroomSalesForPicker } from "@/lib/admin/load-saleroom-sales-picker";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Create event",
  "Create a new invitation-only onsite event and link it to a saleroom sale.",
);

export default async function AdminCreateOnsiteEventPage() {
  const saleroomSales = await loadSaleroomSalesForPicker();
  return <OnsiteEventForm mode="create" saleroomSales={saleroomSales} />;
}
