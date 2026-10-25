import "server-only";

import { loadSaleroomSalesForPicker } from "@/lib/admin/load-saleroom-sales-picker";
import { getAdminSaleById } from "@/lib/data/http/admin-sale-registrations.reader";
import { getAdminOnsiteEventDetail } from "@/lib/data/http/onsite-event.server";

type OnsiteEventDetail = NonNullable<Awaited<ReturnType<typeof getAdminOnsiteEventDetail>>>;

export type EventRsvpEditPageModel = {
  slug: string;
  detail: OnsiteEventDetail | null;
  saleroomSales: Awaited<ReturnType<typeof loadSaleroomSalesForPicker>>;
  /** The linked sale's name, so the picker shows it even when it is not among the options. */
  linkedSaleTitle: string | null;
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

  const linkedSaleTitle = detail?.saleId
    ? await getAdminSaleById(detail.saleId)
        .then((row) => row?.sale.title ?? null)
        .catch(() => null)
    : null;

  return {
    slug,
    detail,
    saleroomSales,
    linkedSaleTitle,
    notFound: !detail,
  };
}
