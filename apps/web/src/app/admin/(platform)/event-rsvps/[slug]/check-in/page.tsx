import { OnsiteEventCheckInConsole } from "@/components/admin/event-rsvps/check-in-console";
import { OnsiteEventBreadcrumbs } from "@/components/admin/event-rsvps/onsite-event-breadcrumbs";
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
  return metadataForPrivate(`${title} — Check-in`, "Scan guest passes at the door.");
}

export default async function AdminOnsiteEventCheckInPage({ params }: Props) {
  const { slug } = await params;
  const detail = await getAdminOnsiteEventDetail(slug).catch(() => null);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <OnsiteEventBreadcrumbs slug={slug} eventTitle={detail.title} current="check-in" />
      <OnsiteEventCheckInConsole slug={slug} title={`${detail.title} · Check-in`} />
    </div>
  );
}
