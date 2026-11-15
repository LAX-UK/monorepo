import {
  type ArtworkRegisterEntry,
  type GallerySalePlan,
  planGallerySale,
} from "@auction/artwork-register-contracts";
import type { IArtworkRegisterRepository } from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import type { SoldWhileLiveReconciler } from "./sold-while-live-monitor.js";

/**
 * `off` does nothing; `dry_run` logs what would be recorded and changes nothing; `live` records the
 * sale. The sync works this out from its own mode and `ZOHO_ARTWORK_LISTING_MODE`: only both live
 * records anything.
 */
export type GallerySaleMode = "off" | "dry_run" | "live";

export function gallerySaleModeFor(
  syncMode: "off" | "dry_run" | "live",
  listingMode: "off" | "dry_run" | "live",
): GallerySaleMode {
  if (syncMode === "off" || listingMode === "off") return "off";
  return syncMode === "live" && listingMode === "live" ? "live" : "dry_run";
}

/** What happened for one artwork; reported with the Product's outcome. */
export type GallerySaleOutcome =
  | { action: "none" }
  | { action: "wait_for_staff"; place: "bid_sale" | "private_sale" }
  | {
      action: "recorded" | "would_record";
      from: "held" | "withdrawn" | "lax_art";
      laxArtListingId: string | null;
    };

const PAGE_SIZE = 200;
/** The most candidates one nightly pass records; the next pass carries on. */
const NIGHTLY_LIMIT = 2_000;

export type GallerySaleDeps = {
  mode: GallerySaleMode;
  register: Pick<
    IArtworkRegisterRepository,
    "findById" | "recordGallerySale" | "listGallerySaleCandidates"
  >;
  /** Raises the "Zoho says Sold" item while the artwork is still on lax.art, before it moves. */
  soldWhileLive?: SoldWhileLiveReconciler;
  log: Logger;
};

/**
 * Zoho says Sold: LAX records the artwork as sold in the gallery (Zoho wins). Before the register
 * moves, the "Zoho says Sold" item is raised for an artwork still on lax.art, so payments for it
 * are held from that moment; it stays open after the move until staff mark it dealt with. The
 * lax.art listing is taken off sale by LAX Shop, which reads the register. A Bid lot or private
 * sale is left to staff, who withdraw it there; the sale is recorded on the next pass after that.
 */
export class GallerySaleRecorder {
  constructor(private readonly deps: GallerySaleDeps) {}

  /**
   * One artwork, given the Zoho Status just read. In a dry run the register is not touched, so the
   * plan is made from the register's place and Zoho's new Status.
   */
  async apply(
    entry: ArtworkRegisterEntry,
    zohoStatus: string | null,
    now: Date,
  ): Promise<GallerySaleOutcome> {
    const { mode, log } = this.deps;
    if (mode === "off") return { action: "none" };
    const plan = planGallerySale({ ...entry, catalogueStatus: zohoStatus });
    if (plan.action !== "record") return planOutcome(plan);

    if (mode === "dry_run") {
      log.info(
        {
          registerId: entry.id,
          stockCode: entry.stockCode,
          from: plan.from,
          laxArtListingId: plan.laxArtListingId,
        },
        "zoho_gallery_sale_dry_run",
      );
      return { action: "would_record", from: plan.from, laxArtListingId: plan.laxArtListingId };
    }
    return this.record(entry, now);
  }

  private async record(entry: ArtworkRegisterEntry, now: Date): Promise<GallerySaleOutcome> {
    const { register, soldWhileLive, log } = this.deps;
    if (soldWhileLive && entry.offer.state === "lax_art") {
      await soldWhileLive.reconcile(entry, now);
    }
    const result = await register.recordGallerySale({ registerId: entry.id, now });
    if (result.status === "not_found") return { action: "none" };
    if (result.status === "unchanged") return planOutcome(result.plan);
    log.info(
      {
        registerId: entry.id,
        stockCode: entry.stockCode,
        from: result.from,
        laxArtListingId: result.laxArtListingId,
      },
      "zoho_gallery_sale_recorded",
    );
    return { action: "recorded", from: result.from, laxArtListingId: result.laxArtListingId };
  }

  /**
   * The nightly pass: every original Zoho shows as Sold that is not yet recorded, which catches a
   * missed notice and an artwork staff have since withdrawn from a Bid lot or private sale.
   */
  async sweep(now: Date): Promise<{ checked: number; recorded: number; failed: number }> {
    const { mode, register, log } = this.deps;
    const totals = { checked: 0, recorded: 0, failed: 0 };
    if (mode === "off") return totals;
    let after: string | undefined;
    while (totals.checked < NIGHTLY_LIMIT) {
      const ids = await register.listGallerySaleCandidates(PAGE_SIZE, after);
      for (const id of ids) {
        totals.checked += 1;
        try {
          const entry = await register.findById(id);
          if (!entry) continue;
          const outcome = await this.apply(entry, entry.catalogueStatus, now);
          if (outcome.action === "recorded" || outcome.action === "would_record") {
            totals.recorded += 1;
          }
        } catch (error) {
          totals.failed += 1;
          log.warn({ err: error, registerId: id }, "zoho gallery sale could not be recorded");
        }
      }
      after = ids.at(-1);
      if (!after || ids.length < PAGE_SIZE) break;
    }
    log.info({ mode, ...totals }, "zoho_gallery_sale_sweep_finished");
    return totals;
  }
}

function planOutcome(plan: GallerySalePlan): GallerySaleOutcome {
  if (plan.action === "wait_for_staff") return { action: "wait_for_staff", place: plan.place };
  if (plan.action === "record") {
    return { action: "would_record", from: plan.from, laxArtListingId: plan.laxArtListingId };
  }
  return { action: "none" };
}
