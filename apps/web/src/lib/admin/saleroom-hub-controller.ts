import { getAdminSalesList } from "@/lib/data/http/admin.server";
import type { AdminSaleListRow } from "@/lib/data/http/admin.server";
import {
  type SaleroomHubSummary,
  filterSaleroomHubRows,
  summarizeSaleroomHub,
} from "@/lib/data/view-models/admin-saleroom-hub.vm";

export type SaleroomHubResult = {
  rows: AdminSaleListRow[];
  summary: SaleroomHubSummary;
};

export const saleroomHubController = {
  id: "saleroom-hub",
  async fetch(): Promise<SaleroomHubResult> {
    const sales = await getAdminSalesList({ limit: 50 });
    const rows = filterSaleroomHubRows(sales);
    return { rows, summary: summarizeSaleroomHub(rows) };
  },
};
