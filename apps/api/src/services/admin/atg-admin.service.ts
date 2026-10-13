import {
  ATG_SYNC_JOB_NAMES,
  type AtgSyncJob,
  type AtgSyncQueueProducer,
  atgSyncJobId,
} from "@auction/queues";
import type { AtgIntegrationStatus, AtgSaleSyncView, AtgSyncAction } from "@auction/types";
import type { IAtgLinkReader } from "../../repositories/interfaces/atg-link.reader.js";
import type {
  AtgAdminError,
  AtgEnqueueResult,
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
  return null;
}

export class AtgAdminService implements IAtgAdminService {
  constructor(
    private readonly reader: IAtgLinkReader,
    /** Null when ATG_SYNC_ENABLED is off. */
    private readonly queue: AtgSyncQueueProducer | null,
    private readonly whiteLabelBaseUrl: string | null,
  ) {}

  status(): AtgIntegrationStatus {
    return { enabled: this.queue != null, whiteLabelBaseUrl: this.whiteLabelBaseUrl };
  }

  getSale(saleId: string): Promise<AtgSaleSyncView | null> {
    return this.reader.getSaleView(saleId);
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

  private async enqueue(
    queue: AtgSyncQueueProducer,
    job: Exclude<AtgSyncJob, { name: "atg.tick" }>,
  ): Promise<AtgEnqueueResult> {
    const jobId = atgSyncJobId(job);
    // Finished jobs must not keep the id, or the next click would be silently ignored;
    // failures stay visible on the link rows and in Sentry.
    await queue.add(job.name, job.data, { jobId, removeOnComplete: true, removeOnFail: true });
    return { ok: true, jobId };
  }
}
