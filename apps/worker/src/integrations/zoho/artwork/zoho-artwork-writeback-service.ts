import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { IArtworkRegisterRepository } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { crmErrorOutcome } from "../../crm/classify-crm-error.js";
import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import type { CrmSyncResult } from "../../crm/crm-sync-result.js";
import {
  type ZohoProductUpdate,
  planStatusUpdate,
  planStockCodeUpdate,
  zohoStatusForOffer,
} from "./writeback-mapping.js";
import type { ZohoProductWriter } from "./zoho-product-writer.js";

/** `off` does nothing; `dry_run` logs what would be sent without calling Zoho; `live` sends it. */
export type ZohoArtworkWritebackMode = "off" | "dry_run" | "live";

export const OFFER_CHANGED_EVENT = "artwork_register.offer_changed";
export const STOCK_CODE_ASSIGNED_EVENT = "artwork_register.stock_code_assigned";

export type ZohoArtworkWritebackDeps = {
  mode: ZohoArtworkWritebackMode;
  products: ZohoProductWriter;
  register: Pick<IArtworkRegisterRepository, "findById" | "recordCatalogueStatusWritten">;
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
 * Once the Status is written the register notes the value, so the change coming back through the
 * inbound sync finds nothing different and is not treated as Zoho's.
 */
export class ZohoArtworkWritebackService {
  private readonly now: () => Date;

  constructor(private readonly deps: ZohoArtworkWritebackDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async deliver(event: WritebackEvent): Promise<CrmSyncResult> {
    const { mode } = this.deps;
    if (mode === "off") return { outcome: "skipped", reason: "writeback_off" };

    const registerId = registerIdOf(event.payload);
    if (!registerId) return { outcome: "skipped", reason: "payload_without_register_id" };
    if (event.eventType !== OFFER_CHANGED_EVENT && event.eventType !== STOCK_CODE_ASSIGNED_EVENT) {
      return { outcome: "skipped", reason: "event_type_not_handled" };
    }

    try {
      const entry = await this.deps.register.findById(registerId);
      if (!entry) return { outcome: "skipped", reason: "register_entry_missing" };
      return event.eventType === OFFER_CHANGED_EVENT
        ? await this.sendStatus(entry, event)
        : await this.sendStockCode(entry, event);
    } catch (err) {
      const { retryable, error } = crmErrorOutcome(err);
      return retryable ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
  }

  private async sendStatus(entry: ArtworkRegisterEntry, event: WritebackEvent) {
    const wanted = zohoStatusForOffer(entry.offer.state);
    if (this.deps.mode === "dry_run") {
      return this.dryRun(entry, event, { Status: wanted });
    }

    const current = await this.requireProduct(entry);
    const update = planStatusUpdate(entry.offer.state, current);
    if (update) await this.deps.products.update(entry.zohoProductId, update.fields);

    // Whether sent now or already there, the register should hold what Zoho holds.
    await this.deps.register.recordCatalogueStatusWritten({
      registerId: entry.id,
      status: wanted,
      now: this.now(),
    });
    return this.finish(entry, update, "status_already_in_sync");
  }

  private async sendStockCode(entry: ArtworkRegisterEntry, event: WritebackEvent) {
    if (this.deps.mode === "dry_run") {
      return this.dryRun(entry, event, { Reference_Stock_Code: entry.stockCode });
    }
    const current = await this.requireProduct(entry);
    const update = planStockCodeUpdate(entry.stockCode, current);
    if (update) await this.deps.products.update(entry.zohoProductId, update.fields);
    return this.finish(entry, update, "stock_code_already_in_sync");
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
    return { outcome: "skipped", reason: "dry_run" };
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

  private finish(
    entry: ArtworkRegisterEntry,
    update: ZohoProductUpdate | null,
    unchangedReason: string,
  ): CrmSyncResult {
    return update
      ? { outcome: "success", providerReference: `Products:${entry.zohoProductId}` }
      : { outcome: "skipped", reason: unchangedReason };
  }
}

function registerIdOf(payload: unknown): string | null {
  const id = (payload as { registerId?: unknown } | null)?.registerId;
  return typeof id === "string" && id.length > 0 ? id : null;
}
