import type { AtgIntegrationStatus, AtgSaleSyncView, AtgSyncAction } from "@auction/types";

export type AtgAdminError = {
  status: 404 | 409 | 503;
  code:
    | "atg_disabled"
    | "sale_not_found"
    | "not_linked"
    | "lot_not_linked"
    | "atg_closed"
    | "sale_cancelled";
  message: string;
};

export type AtgEnqueueResult = { ok: true; jobId: string } | { ok: false; error: AtgAdminError };

/** Staff-facing ATG operations. Reads link state; writes only by enqueueing worker jobs. */
export interface IAtgAdminService {
  status(): AtgIntegrationStatus;
  getSale(saleId: string): Promise<AtgSaleSyncView | null>;
  enqueueSaleAction(saleId: string, action: AtgSyncAction): Promise<AtgEnqueueResult>;
  enqueueLotDelete(lotId: string): Promise<AtgEnqueueResult>;
}
