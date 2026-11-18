import type { IZohoListingSourceReader } from "@auction/persistence/interfaces";
import { ARTWORK_LISTING_SKIP } from "@auction/types";
import { crmErrorOutcome } from "../../../crm/classify-crm-error.js";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import type { CrmSyncResult } from "../../../crm/crm-sync-result.js";
import { type ListingTriggerEvent, registerIdsFor } from "./listing-triggers.js";
import type { ListingSyncReport, ZohoListingSync } from "./zoho-listing-sync.js";

/**
 * Refreshes the LAX listing on Zoho for the artworks an event can move. Delivery is at least once
 * and in any order; that is safe because the listing is worked out from LAX's state when the event
 * is handled and sent only when Zoho shows something else.
 */
export class ZohoListingWriteback {
  constructor(
    private readonly deps: {
      sync: Pick<ZohoListingSync, "sync">;
      sources: Pick<
        IZohoListingSourceReader,
        "registerIdsForLot" | "registerIdsForSale" | "registerIdsForLaxArtListing"
      >;
      mode: "dry_run" | "live";
    },
  ) {}

  async deliver(event: ListingTriggerEvent & { id?: number }): Promise<CrmSyncResult> {
    try {
      const ids = await registerIdsFor(event, this.deps.sources);
      if (ids === null)
        return { outcome: "skipped", reason: ARTWORK_LISTING_SKIP.eventTypeNotHandled };
      if (ids.length === 0)
        return { outcome: "skipped", reason: ARTWORK_LISTING_SKIP.noRegisterEntry };
      return this.outcome(await this.deps.sync.sync(ids));
    } catch (err) {
      const { retryable, error } = crmErrorOutcome(err);
      return retryable ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
  }

  /** A retryable failure retries the whole event (the rest is already in line); else it fails. */
  private outcome(report: ListingSyncReport): CrmSyncResult {
    const retry = report.failures.find((failure) => failure.retryable);
    const failed = retry ?? report.failures[0];
    if (failed) {
      const error = new CrmGatewayError({
        code: failed.code,
        message: `LAX listing not written for ${failed.stockCode ?? failed.registerId}`,
        status: retry ? 503 : 400,
        retryable: Boolean(retry),
      });
      return retry ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
    if (report.changed > 0) {
      return this.deps.mode === "dry_run"
        ? { outcome: "skipped", reason: ARTWORK_LISTING_SKIP.dryRun }
        : { outcome: "success", providerReference: `Products:${report.changed}` };
    }
    if (report.checked === 0)
      return { outcome: "skipped", reason: ARTWORK_LISTING_SKIP.notAnOriginal };
    return {
      outcome: "skipped",
      reason:
        report.stale > 0
          ? ARTWORK_LISTING_SKIP.newerListingInZoho
          : ARTWORK_LISTING_SKIP.listingAlreadyInSync,
    };
  }
}
