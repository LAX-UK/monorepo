import type {
  AtgIntegrationStatus,
  AtgSaleSettings,
  AtgSaleSyncView,
  AtgSyncAction,
  AtgSyncJobState,
} from "@auction/types";

export type AtgAdminError = {
  status: 404 | 409 | 503;
  code:
    | "atg_disabled"
    | "sale_not_found"
    | "not_linked"
    | "lot_not_linked"
    | "atg_closed"
    | "sale_cancelled"
    | "sale_on_lax"
    | "atg_settings_locked"
    | "public_confirmation_required"
    | "queue_unavailable";
  message: string;
};

export type AtgEnqueueResult = { ok: true; jobId: string } | { ok: false; error: AtgAdminError };

export type AtgSaleSettingsInput = AtgSaleSettings & {
  /** Must be true to move a sale from private testing to the public marketplace. */
  confirmPublic: boolean;
};

export type AtgSettingsResult =
  | {
      ok: true;
      settings: AtgSaleSettings;
      /** Push queued so ATG gets the change; null when not linked, ATG is off, or Redis failed. */
      pushJobId: string | null;
    }
  | { ok: false; error: AtgAdminError };

/** Staff-facing ATG operations. Writes ATG traffic only by enqueueing worker jobs. */
export interface IAtgAdminService {
  status(): AtgIntegrationStatus;
  getSale(saleId: string): Promise<AtgSaleSyncView | null>;
  enqueueSaleAction(saleId: string, action: AtgSyncAction): Promise<AtgEnqueueResult>;
  enqueueLotDelete(lotId: string): Promise<AtgEnqueueResult>;
  getJobState(jobId: string): Promise<AtgSyncJobState | null>;
  updateSaleSettings(
    saleId: string,
    input: AtgSaleSettingsInput,
    actorUserId: string,
  ): Promise<AtgSettingsResult>;
}
