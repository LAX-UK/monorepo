import "server-only";

import { saleroomHubController } from "@/lib/admin/saleroom-hub-controller";
import { buildSaleroomHubViewData } from "@/lib/admin/saleroom-hub-page-data";
import type { AdminSaleListRow } from "@/lib/data/http/admin-sale-registrations.types";
import type { SaleroomHubSummary } from "@/lib/data/view-models/admin-saleroom-hub.vm";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";

export type SaleroomHubPageModel = {
  summary: SaleroomHubSummary;
  rows: AdminSaleListRow[];
  hubView: Awaited<ReturnType<typeof buildSaleroomHubViewData>> | null;
  loadError: string | null;
};

/** Hub list + session enrichment for `/admin/saleroom`. */
export async function loadSaleroomHubPage(): Promise<SaleroomHubPageModel> {
  try {
    const result = await saleroomHubController.fetch();
    const hubView = await buildSaleroomHubViewData(result.rows);
    return {
      summary: result.summary,
      rows: result.rows,
      hubView,
      loadError: null,
    };
  } catch (e) {
    return {
      summary: { liveCount: 0, scheduledCount: 0, availableCount: 0 },
      rows: [],
      hubView: null,
      loadError: e instanceof Error ? e.message : "Could not load sales.",
    };
  }
}

export type SaleroomHubLiveSessions = Record<string, PublicSaleroomSessionStatus>;
