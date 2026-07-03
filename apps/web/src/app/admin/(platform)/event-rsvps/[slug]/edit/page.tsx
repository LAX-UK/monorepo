import { OnsiteEventForm } from "@/components/admin/event-rsvps/onsite-event-form";
import { loadSaleroomSalesForPicker } from "@/lib/admin/load-saleroom-sales-picker";
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
  const [detail, saleroomSales] = await Promise.all([
    getAdminOnsiteEventDetail(slug),
    loadSaleroomSalesForPicker(),
  ]);
  if (!detail) notFound();
  return <OnsiteEventForm mode="edit" initial={detail} saleroomSales={saleroomSales} />;
}
