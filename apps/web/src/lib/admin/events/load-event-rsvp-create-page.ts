import "server-only";

import { loadSaleroomSalesForPicker } from "@/lib/admin/load-saleroom-sales-picker";

export type EventRsvpCreatePageModel = {
  saleroomSales: Awaited<ReturnType<typeof loadSaleroomSalesForPicker>>;
};

/** Data/composition boundary for `/admin/event-rsvps/new`. */
export async function loadAdminEventRsvpCreatePage(): Promise<EventRsvpCreatePageModel> {
  const saleroomSales = await loadSaleroomSalesForPicker();
  return { saleroomSales };
}
