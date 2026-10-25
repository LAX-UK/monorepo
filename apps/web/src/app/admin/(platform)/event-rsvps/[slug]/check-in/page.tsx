import { OnsiteEventCheckInConsole } from "@/components/admin/event-rsvps/check-in-console";
import { loadAdminEventRsvpCheckInPage } from "@/lib/admin/events/load-event-rsvp-check-in-page";
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
  const title = detail?.title ?? slug;
  return metadataForPrivate(`${title} check-in`, "Scan guest passes at the door.");
}

export default async function AdminOnsiteEventCheckInPage({ params }: Props) {
  const { slug } = await params;
  const model = await loadAdminEventRsvpCheckInPage({ slug });
  if (model.notFound) notFound();

  return <OnsiteEventCheckInConsole slug={slug} title={model.title} />;
}
