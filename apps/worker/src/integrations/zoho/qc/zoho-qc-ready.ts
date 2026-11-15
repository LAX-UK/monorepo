import type { QcReadyOutcome, QcReadyToPackRequest } from "@auction/artwork-register-contracts";
import type { ZohoQcModule } from "@auction/queues";
import type { Logger } from "pino";
import type { ZohoOrderRecords } from "../fulfilment/zoho-order-modules.js";

/** The status Zoho's quality check puts on a job that passed. */
export const ZOHO_QC_PASSED = "QC Passed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** LAX Shop's half: moves the print on. Zoho is read, never written, by this whole path. */
export interface QcReadyShop {
  markPassed(request: QcReadyToPackRequest): Promise<QcReadyOutcome>;
}

/**
 * Something staff must look at: the record is gone, names no LAX line, or LAX cannot move the
 * print. Thrown, so the notice is retried and then shows in Failed jobs; nothing is guessed.
 */
export class ZohoQcAttentionError extends Error {
  constructor(reason: string) {
    super(`zoho_qc_attention:${reason}`);
    this.name = "ZohoQcAttentionError";
  }
}

export type ZohoQcNotice = {
  module: ZohoQcModule;
  recordId: string;
  /** When Zoho said the record changed, if the workflow sent it (ISO 8601). */
  modifiedTime?: string;
};

export type ZohoQcResult =
  | { status: "off" }
  | { status: "not_passed"; zohoStatus: string | null }
  | { status: "would_move" }
  | { status: "moved" | "already" };

/**
 * A Zoho job's quality check passing becomes the LAX print's "quality check passed". A notice is
 * only a hint: the record is read as Zoho holds it now, so an older notice processed late sees the
 * newer state and cannot undo it, and a notice for a status that is not QC Passed does nothing.
 * LAX Shop only ever moves a task forward, so a repeat is "already". Mirroring the order back to
 * Zoho (ZC-2) never writes QC Passed, and this path writes nothing to Zoho, so no loop forms.
 */
export class ZohoQcReady {
  constructor(
    private readonly deps: {
      mode: "off" | "dry_run" | "live";
      zoho: Pick<ZohoOrderRecords, "find">;
      shop: QcReadyShop;
      /** API name of the order-reference field on the Zoho job. */
      orderRefField: string;
      log: Logger;
    },
  ) {}

  async process(notice: ZohoQcNotice): Promise<ZohoQcResult> {
    const { mode, zoho, shop, orderRefField, log } = this.deps;
    if (mode === "off") return { status: "off" };

    const record = await zoho.find(notice.module, "id", notice.recordId, [
      "Status",
      "Modified_Time",
      orderRefField,
    ]);
    if (!record) throw new ZohoQcAttentionError("record_not_found_in_zoho");

    // Zoho answering with a version older than the notice is a lag, not a state: try again.
    const seen = Date.parse(String(record.fields.Modified_Time ?? ""));
    if (notice.modifiedTime && !Number.isNaN(seen) && seen < Date.parse(notice.modifiedTime)) {
      throw new Error("zoho_qc_record_older_than_notice");
    }

    const status = typeof record.fields.Status === "string" ? record.fields.Status : null;
    if (status !== ZOHO_QC_PASSED) return { status: "not_passed", zohoStatus: status };

    const ref = String(record.fields[orderRefField] ?? "");
    const at = ref.lastIndexOf("/");
    const lineId = ref.slice(at + 1);
    if (at < 1 || !UUID.test(lineId))
      throw new ZohoQcAttentionError("order_ref_missing_or_invalid");
    const request = {
      orderReference: ref.slice(0, at),
      lineId,
      zohoModule: notice.module,
      zohoRecordId: notice.recordId,
    };

    if (mode === "dry_run") {
      log.info(
        { module: notice.module, recordId: notice.recordId, ...request },
        "zoho qc would move print, nothing written",
      );
      return { status: "would_move" };
    }
    const outcome = await shop.markPassed(request);
    if (outcome === "moved" || outcome === "already") return { status: outcome };
    throw new ZohoQcAttentionError(outcome);
  }
}
