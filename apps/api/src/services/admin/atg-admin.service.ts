import type { IAtgLinkReader, IAtgSaleSettingsWriter } from "@auction/persistence/interfaces";
import {
  ATG_SYNC_JOB_NAMES,
  type AtgSyncJob,
  type AtgSyncQueueProducer,
  atgSyncJobId,
} from "@auction/queues";
import {
  type AtgIntegrationStatus,
  type AtgLotSellingSummary,
  type AtgSaleSellingSummary,
  type AtgSaleSyncView,
  type AtgSyncAction,
  type AtgSyncJobState,
  canChangeAtgAuctionType,
  canChangeAtgDistribution,
  canPushOrPublishSaleOnAtg,
} from "@auction/types";
import type {
  AtgAdminError,
  AtgEnqueueResult,
  AtgSaleSettingsInput,
  AtgSettingsResult,
  IAtgAdminService,
} from "../interfaces/atg-admin-service.js";

const SALE_ACTION_JOB = {
  push: ATG_SYNC_JOB_NAMES.pushSale,
  publish: ATG_SYNC_JOB_NAMES.publishSale,
  close: ATG_SYNC_JOB_NAMES.closeSale,
} as const;

const DISABLED: AtgAdminError = {
  status: 503,
  code: "atg_disabled",
  message: "ATG sync is not enabled in this environment",
};

function saleActionConflict(
  view: AtgSaleSyncView,
  action: AtgSyncAction,
): Pick<AtgAdminError, "code" | "message"> | null {
  if (view.remoteStatus === "closed") {
    return { code: "atg_closed", message: "The ATG auction is closed and can no longer change" };
  }
  if (action === "close") {
    return view.linked ? null : { code: "not_linked", message: "Sale has not been pushed to ATG" };
  }
  if (view.saleCancelled) {
    return { code: "sale_cancelled", message: "Cancelled sales cannot be pushed to ATG" };
  }
  if (!canPushOrPublishSaleOnAtg(view.sellingPlatform)) {
    return {
      code: "sale_on_lax",
      message: "This sale is published on lax.bid. Unpublish it there before pushing to ATG.",
    };
  }
  return null;
}

function settingsConflict(
  view: AtgSaleSyncView,
  input: AtgSaleSettingsInput,
): Pick<AtgAdminError, "code" | "message"> | null {
  if (view.remoteStatus === "closed") {
    return { code: "atg_closed", message: "The ATG auction is closed and can no longer change" };
  }
  if (view.saleCancelled) {
    return { code: "sale_cancelled", message: "Cancelled sales cannot be sent to ATG" };
  }
  if (!canPushOrPublishSaleOnAtg(view.sellingPlatform)) {
    return {
      code: "sale_on_lax",
      message:
        "This sale is published on lax.bid. Unpublish it there before changing ATG settings.",
    };
  }
  if (input.auctionType !== view.settings.auctionType && !canChangeAtgAuctionType(view)) {
    return {
      code: "atg_settings_locked",
      message: "The auction type can't change once ATG has the auction.",
    };
  }
  if (input.distribution !== view.settings.distribution && !canChangeAtgDistribution(view)) {
    return {
      code: "atg_settings_locked",
      message: "Distribution can't change once the auction is published on ATG.",
    };
  }
  if (
    input.distribution === "public_marketplace" &&
    view.settings.distribution !== "public_marketplace" &&
    !input.confirmPublic
  ) {
    return {
      code: "public_confirmation_required",
      message: "Confirm that this sale may be listed publicly on the White Label and The Saleroom.",
    };
  }
  return null;
}

/** Structured audit log line for staff settings changes (the row keeps the latest actor). */
export type AtgSettingsAuditLog = { info(obj: Record<string, unknown>, msg: string): void };

export class AtgAdminService implements IAtgAdminService {
  constructor(
    private readonly reader: IAtgLinkReader,
    private readonly settingsWriter: IAtgSaleSettingsWriter,
    /** Null when ATG_SYNC_ENABLED is off. */
    private readonly queue: AtgSyncQueueProducer | null,
    private readonly whiteLabelBaseUrl: string | null,
    private readonly audit: AtgSettingsAuditLog,
    private readonly now: () => Date = () => new Date(),
  ) {}

  status(): AtgIntegrationStatus {
    return { enabled: this.queue != null, whiteLabelBaseUrl: this.whiteLabelBaseUrl };
  }

  getSale(saleId: string): Promise<AtgSaleSyncView | null> {
    return this.reader.getSaleView(saleId);
  }

  async getSaleSellingSummaries(saleIds: string[]): Promise<Record<string, AtgSaleSellingSummary>> {
    return Object.fromEntries(await this.reader.getSaleSellingSummaries(saleIds));
  }

  async getLotSellingSummaries(lotIds: string[]): Promise<Record<string, AtgLotSellingSummary>> {
    return Object.fromEntries(await this.reader.getLotSellingSummaries(lotIds));
  }

  async enqueueSaleAction(saleId: string, action: AtgSyncAction): Promise<AtgEnqueueResult> {
    if (!this.queue) return { ok: false, error: DISABLED };
    const view = await this.reader.getSaleView(saleId);
    if (!view) {
      return {
        ok: false,
        error: { status: 404, code: "sale_not_found", message: "Sale not found" },
      };
    }
    const conflict = saleActionConflict(view, action);
    if (conflict) return { ok: false, error: { status: 409, ...conflict } };
    return this.enqueue(this.queue, { name: SALE_ACTION_JOB[action], data: { saleId } });
  }

  async enqueueLotDelete(lotId: string): Promise<AtgEnqueueResult> {
    if (!this.queue) return { ok: false, error: DISABLED };
    if (!(await this.reader.findAtgLotId(lotId))) {
      return {
        ok: false,
        error: { status: 404, code: "lot_not_linked", message: "Lot is not on ATG" },
      };
    }
    return this.enqueue(this.queue, { name: ATG_SYNC_JOB_NAMES.deleteLot, data: { lotId } });
  }

  async getJobState(jobId: string): Promise<AtgSyncJobState | null> {
    if (!this.queue) return null;
    return this.queue.getJobState(jobId);
  }

  /** Saving works while ATG sync is off, so sales can be prepared before go-live. */
  async updateSaleSettings(
    saleId: string,
    input: AtgSaleSettingsInput,
    actorUserId: string,
  ): Promise<AtgSettingsResult> {
    const view = await this.reader.getSaleView(saleId);
    if (!view) {
      return {
        ok: false,
        error: { status: 404, code: "sale_not_found", message: "Sale not found" },
      };
    }
    const settings = { auctionType: input.auctionType, distribution: input.distribution };
    const conflict = settingsConflict(view, input);
    if (conflict) return { ok: false, error: { status: 409, ...conflict } };

    const unchanged =
      settings.auctionType === view.settings.auctionType &&
      settings.distribution === view.settings.distribution;
    if (unchanged) return { ok: true, settings, pushJobId: null };

    if (!(await this.settingsWriter.saveSettings(saleId, settings, actorUserId, this.now()))) {
      return {
        ok: false,
        error: {
          status: 409,
          code: "atg_settings_locked",
          message: "The ATG auction changed while saving. Reload and try again.",
        },
      };
    }
    this.audit.info(
      {
        action: "atg_sale_settings_updated",
        saleId,
        actorUserId,
        from: view.settings,
        to: settings,
      },
      "atg_admin_mutation",
    );

    let pushJobId: string | null = null;
    if (this.queue && view.linked) {
      const pushed = await this.enqueue(this.queue, {
        name: ATG_SYNC_JOB_NAMES.pushSale,
        data: { saleId },
      });
      if (pushed.ok) pushJobId = pushed.jobId;
    }
    return { ok: true, settings, pushJobId };
  }

  private async enqueue(
    queue: AtgSyncQueueProducer,
    job: Exclude<AtgSyncJob, { name: "atg.tick" }>,
  ): Promise<AtgEnqueueResult> {
    const jobId = atgSyncJobId(job);
    try {
      await queue.add(job.name, job.data, { jobId, removeOnComplete: true, removeOnFail: true });
    } catch {
      return {
        ok: false,
        error: {
          status: 503,
          code: "queue_unavailable",
          message: "ATG queue is unavailable. Try again shortly.",
        },
      };
    }
    return { ok: true, jobId };
  }
}
