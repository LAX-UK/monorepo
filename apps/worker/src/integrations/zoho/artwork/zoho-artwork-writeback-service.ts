import { type ArtworkRegisterEntry, zohoModuleOf } from "@auction/artwork-register-contracts";
import type {
  IArtworkRegisterRepository,
  IZohoStatusSourceReader,
} from "@auction/persistence/interfaces";
import { ARTWORK_WRITEBACK_EVENT, ARTWORK_WRITEBACK_SKIP } from "@auction/types";
import type { Logger } from "pino";
import { crmErrorOutcome } from "../../crm/classify-crm-error.js";
import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import type { CrmSyncResult } from "../../crm/crm-sync-result.js";
import {
  type StatusOutcome,
  type ZohoStatusSync,
  wantedStatus,
} from "./status/zoho-status-sync.js";
import { planStockCodeUpdate } from "./writeback-mapping.js";
import type { ZohoProductWriter } from "./zoho-product-writer.js";

/** `off` does nothing; `dry_run` logs what would be sent without calling Zoho; `live` sends it. */
export type ZohoArtworkWritebackMode = "off" | "dry_run" | "live";

export const OFFER_CHANGED_EVENT = ARTWORK_WRITEBACK_EVENT.offerChanged;
export const STOCK_CODE_ASSIGNED_EVENT = ARTWORK_WRITEBACK_EVENT.stockCodeAssigned;

/** The skip reasons, shared with LAX Admin's "Mirrored to Zoho" read. */
const SKIP = ARTWORK_WRITEBACK_SKIP;

export type ZohoArtworkWritebackDeps = {
  mode: ZohoArtworkWritebackMode;
  products: ZohoProductWriter;
  register: Pick<IArtworkRegisterRepository, "findById" | "recordStockCodeConflict">;
  /** Compares the Zoho Status and sets it only where that is safe. */
  status: Pick<ZohoStatusSync, "sync">;
  /** For a dry run, which reads LAX alone and never reaches Zoho. */
  sources: Pick<IZohoStatusSourceReader, "readStatusSources">;
  log: Logger;
  now?: () => Date;
};

type WritebackEvent = { id?: number; eventType: string; payload: unknown };

/**
 * Sends LAX-owned artwork state to the Zoho Product: the place the artwork is offered (as the
 * Status) and its stock code. Nothing else is written; Zoho owns the catalogue.
 *
 * The register is read when the event is handled, never taken from the event, so a late, repeated
 * or out-of-order event can only ever send the state that is true now. Zoho is read before a
 * write and left alone when it already holds the value, so delivering twice sends once.
 *
 * The Status is Zoho's to hold, so it is compare-and-set (see `ZohoStatusSync`): a Sold or
 * Reserved that staff set in Zoho is never written over, and the difference is raised as a
 * conflict instead. Once the Status is written the register notes it, so the change coming back
 * through the inbound sync finds nothing different and is not treated as Zoho's.
 */
export class ZohoArtworkWritebackService {
  private readonly now: () => Date;

  constructor(private readonly deps: ZohoArtworkWritebackDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async deliver(event: WritebackEvent): Promise<CrmSyncResult> {
    const { mode } = this.deps;
    if (mode === "off") return { outcome: "skipped", reason: SKIP.writebackOff };

    const registerId = registerIdOf(event.payload);
    if (!registerId) return { outcome: "skipped", reason: SKIP.payloadWithoutRegisterId };
    if (event.eventType !== OFFER_CHANGED_EVENT && event.eventType !== STOCK_CODE_ASSIGNED_EVENT) {
      return { outcome: "skipped", reason: SKIP.eventTypeNotHandled };
    }

    try {
      const entry = await this.deps.register.findById(registerId);
      if (!entry) return { outcome: "skipped", reason: SKIP.registerEntryMissing };
      // A print group's Zoho record is a Print_Products one, whose code is its Print_Group_ID; the
      // Products fields written here do not exist for it. A print that came in from Zoho is a
      // Product and is written like any other.
      if (zohoModuleOf(entry) === "Print_Products") {
        return { outcome: "skipped", reason: SKIP.printGroupNotAProduct };
      }
      return event.eventType === OFFER_CHANGED_EVENT
        ? await this.sendStatus(entry, event)
        : await this.sendStockCode(entry, event);
    } catch (err) {
      const { retryable, error } = crmErrorOutcome(err);
      return retryable ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
  }

  private async sendStatus(entry: ArtworkRegisterEntry, event: WritebackEvent) {
    if (this.deps.mode === "dry_run") {
      const [source] = await this.deps.sources.readStatusSources([entry.id]);
      return this.dryRun(entry, event, {
        Status: source ? wantedStatus(source, this.now()) : "unknown",
      });
    }
    const [outcome] = await this.deps.status.sync([entry.id]);
    return statusResult(entry, outcome);
  }

  /** A stock code edited in Zoho is raised as the register's stock code conflict, never overwritten. */
  private async sendStockCode(
    entry: ArtworkRegisterEntry,
    event: WritebackEvent,
  ): Promise<CrmSyncResult> {
    if (this.deps.mode === "dry_run") {
      return this.dryRun(entry, event, { Reference_Stock_Code: entry.stockCode });
    }
    const current = await this.requireProduct(entry);
    const plan = planStockCodeUpdate(entry.stockCode, current);
    if (plan.kind === "in_sync") return { outcome: "skipped", reason: SKIP.stockCodeAlreadyInSync };
    if (plan.kind === "conflict") {
      await this.deps.register.recordStockCodeConflict({
        registerId: entry.id,
        zohoStockCode: plan.zohoStockCode,
        laxStockCode: entry.stockCode,
        zohoModifiedAt: current.modifiedAt ?? this.now(),
        now: this.now(),
      });
      this.deps.log.info(
        { registerId: entry.id, zohoStockCode: plan.zohoStockCode, stockCode: entry.stockCode },
        "zoho_stock_code_conflict",
      );
      return { outcome: "skipped", reason: SKIP.stockCodeConflictRaised };
    }
    await this.deps.products.update(entry.zohoProductId, plan.update.fields);
    return { outcome: "success", providerReference: `Products:${entry.zohoProductId}` };
  }

  private dryRun(
    entry: ArtworkRegisterEntry,
    event: WritebackEvent,
    fields: Record<string, string>,
  ): CrmSyncResult {
    this.deps.log.info(
      {
        eventId: event.id,
        eventType: event.eventType,
        registerId: entry.id,
        zohoProductId: entry.zohoProductId,
        stockCode: entry.stockCode,
        fields,
      },
      "zoho_artwork_writeback_dry_run",
    );
    return { outcome: "skipped", reason: SKIP.dryRun };
  }

  private async requireProduct(entry: ArtworkRegisterEntry) {
    const current = await this.deps.products.read(entry.zohoProductId);
    if (current) return current;
    throw new CrmGatewayError({
      code: "product_not_found",
      message: `Zoho Product ${entry.zohoProductId} no longer exists`,
      status: 404,
      retryable: false,
    });
  }
}

/** A conflict is for staff and sending again cannot settle it; a failure or a stale read can. */
function statusResult(
  entry: ArtworkRegisterEntry,
  outcome: StatusOutcome | undefined,
): CrmSyncResult {
  switch (outcome?.kind) {
    case "written":
      return { outcome: "success", providerReference: `Products:${entry.zohoProductId}` };
    case "in_sync":
      return { outcome: "skipped", reason: SKIP.statusAlreadyInSync };
    case "conflict":
      return { outcome: "skipped", reason: SKIP.statusConflictRaised };
    case "skipped":
      return { outcome: "skipped", reason: outcome.reason };
    case "stale":
      throw new CrmGatewayError({
        code: "status_changed_in_zoho_during_read",
        message: `Zoho Product ${entry.zohoProductId} changed while its Status was being compared`,
        status: 409,
        retryable: true,
      });
    case "failed":
      throw new CrmGatewayError({
        code: outcome.code,
        message: `Zoho Status for ${entry.zohoProductId} was not written: ${outcome.code}`,
        status: 400,
        retryable: outcome.retryable,
      });
    case undefined:
      return { outcome: "skipped", reason: SKIP.registerEntryMissing };
  }
}

function registerIdOf(payload: unknown): string | null {
  const id = (payload as { registerId?: unknown } | null)?.registerId;
  return typeof id === "string" && id.length > 0 ? id : null;
}
