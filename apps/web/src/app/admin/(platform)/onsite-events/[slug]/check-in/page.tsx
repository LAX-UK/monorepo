import { OnsiteEventCheckInConsole } from "@/components/admin/onsite-events/check-in-console";
import { getAdminOnsiteEventDetail } from "@/lib/data/http/onsite-event.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="space-y-4">
      <Link
        href={`/admin/onsite-events/${encodeURIComponent(slug)}`}
        className="font-body text-sm text-on-surface-variant underline-offset-4 hover:underline"
      >
        Back to RSVPs
      </Link>
      <OnsiteEventCheckInConsole slug={slug} title={`${detail.title} · Check-in`} />
    </div>
  );
}
