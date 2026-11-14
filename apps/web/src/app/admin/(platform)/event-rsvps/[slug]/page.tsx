import {
  OnsiteEventDetail,
  OnsiteEventUnavailable,
} from "@/components/admin/event-rsvps/onsite-event-detail";
import { OnsiteEventRefreshOnReturn } from "@/components/admin/event-rsvps/onsite-event-refresh-on-return";
import { eventRsvpHref } from "@/lib/admin/events/event-rsvps-staff-list.vm";
import { loadAdminEventRsvpDetailPage } from "@/lib/admin/events/load-event-rsvp-detail-page";
import { loadEventRsvpsListIds } from "@/lib/admin/events/load-event-rsvps-hub-page";
import { loadListRecordPager } from "@/lib/admin/list-record-pager.server";
import { getAdminOnsiteEventDetail } from "@/lib/data/http/onsite-event.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { listQueryFromRecord } from "@auction/staff-ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const [model, pager] = await Promise.all([
    loadAdminEventRsvpDetailPage({ slug }),
    // Opened from the events list: Previous and Next through that list.
    loadListRecordPager({
      listQuery: listQueryFromRecord(sp),
      currentId: slug,
      recordHref: eventRsvpHref,
      loadIds: loadEventRsvpsListIds,
    }),
  ]);

  if (model.notFound) notFound();

  if (!model.detail) {
    return (
      <OnsiteEventUnavailable message={model.loadError ?? "Could not load onsite event data."} />
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <OnsiteEventRefreshOnReturn />
      </Suspense>
      <OnsiteEventDetail
        event={model.detail}
        rsvps={model.rsvps}
        venueDayCounts={model.venueDayCounts}
        linkedSaleTitle={model.linkedSaleTitle}
        loadError={model.loadError}
        pager={pager}
      />
    </>
  );
}
