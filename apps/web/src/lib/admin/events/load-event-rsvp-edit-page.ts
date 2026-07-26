import "server-only";

import { loadSaleroomSalesForPicker } from "@/lib/admin/load-saleroom-sales-picker";
import { getAdminOnsiteEventDetail } from "@/lib/data/http/onsite-event.server";

type OnsiteEventDetail = NonNullable<Awaited<ReturnType<typeof getAdminOnsiteEventDetail>>>;

export type EventRsvpEditPageModel = {
  slug: string;
  detail: OnsiteEventDetail | null;
  saleroomSales: Awaited<ReturnType<typeof loadSaleroomSalesForPicker>>;
  notFound: boolean;
};

type LoadEventRsvpEditPageInput = {
  slug: string;
};

/** Data/composition boundary for `/admin/event-rsvps/[slug]/edit`. */
export async function loadAdminEventRsvpEditPage({
  slug,
}: LoadEventRsvpEditPageInput): Promise<EventRsvpEditPageModel> {
  const [detail, saleroomSales] = await Promise.all([
    getAdminOnsiteEventDetail(slug),
    loadSaleroomSalesForPicker(),
  ]);

  return {
    slug,
    detail,
    saleroomSales,
    notFound: !detail,
  };
}
