import type { IArtworkRegisterRepository } from "@auction/persistence/interfaces";
import type {
  IZohoArtworkSyncReport,
  IZohoArtworkSyncWatermark,
  ZohoArtworkSyncMode,
  ZohoArtworkSyncOutcomeInput,
  ZohoArtworkSyncSummary,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { type ProductAssessment, assessProduct } from "./assess-product.js";
import type { CatalogueProduct } from "./catalogue-product.js";
import { type ArtworkDecision, decideArtworkOutcome } from "./decide-outcome.js";
import { type LinkedListingProjector, listingFactsOf } from "./linked-listing-projector.js";
import type { ZohoCatalogueReader } from "./zoho-catalogue-reader.js";

/** `off` does nothing; `dry_run` reports what would change; `live` changes the register. */
export type ZohoArtworkSyncModeSetting = "off" | ZohoArtworkSyncMode;

export type ZohoArtworkSyncDeps = {
  mode: ZohoArtworkSyncModeSetting;
  reader: ZohoCatalogueReader;
  register: IArtworkRegisterRepository;
  report: IZohoArtworkSyncReport;
  watermark: IZohoArtworkSyncWatermark;
  /** Carries Zoho's fields onto the lax.art listing made from a record, when there is one. */
  listings?: LinkedListingProjector;
  log: Logger;
  now?: () => Date;
};

export type ZohoArtworkSyncRunResult =
  | { ran: false; reason: "mode_off" }
  | { ran: true; runId: string; summary: ZohoArtworkSyncSummary };

const REGISTER_ACTOR = "zoho";

function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Brings Zoho Product changes into the artwork register. A change reaches it two ways, a signed
 * notice for one Product or the nightly check for everything changed since the last pass, and
 * both end up in the same place: read the Product, decide, then apply (live) or report (dry run).
 *
 * In dry run nothing in the register changes; each Product's result is recorded so the report
 * shows exactly what live would do.
 */
export class ZohoArtworkSyncService {
  private readonly now: () => Date;

  constructor(private readonly deps: ZohoArtworkSyncDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Handles one notice: reads that Product from Zoho and processes it. */
  async processNotice(input: {
    productId: string;
    runId: string;
  }): Promise<ZohoArtworkSyncRunResult> {
    const { mode, reader, report, log } = this.deps;
    if (mode === "off") {
      log.debug({ productId: input.productId }, "zoho artwork notice ignored: sync is off");
      return { ran: false, reason: "mode_off" };
    }

    const product = await reader.fetchProduct(input.productId);
    const outcomes: ZohoArtworkSyncOutcomeInput[] = product
      ? await this.processProducts(mode, [product])
      : [
          {
            zohoProductId: input.productId,
            stockCode: null,
            title: null,
            outcome: "skipped",
            reason: "not_found_in_zoho",
            detail: {},
            zohoModifiedAt: null,
          },
        ];
    await report.record(input.runId, mode, outcomes, this.now());
    return { ran: true, runId: input.runId, summary: await report.summarise(input.runId) };
  }

  /**
   * Reads every Product changed since the last finished pass and processes it. With no earlier
   * pass this reads all Products, which is the import report. The watermark moves only once every
   * page is done, so a failed pass is read again from the same place.
   */
  async runNightly(): Promise<ZohoArtworkSyncRunResult> {
    const { mode, reader, report, watermark, log } = this.deps;
    if (mode === "off") return { ran: false, reason: "mode_off" };

    const startedAt = this.now();
    const runId = `nightly:${mode}:${dayOf(startedAt)}`;
    const since = await watermark.get(mode);
    let newest: Date | null = since;
    let read = 0;

    for await (const page of reader.fetchModifiedSince(since)) {
      const outcomes = await this.processProducts(mode, page);
      await report.record(runId, mode, outcomes, this.now());
      read += page.length;
      for (const product of page) {
        if (product.modifiedAt && (!newest || product.modifiedAt > newest)) {
          newest = product.modifiedAt;
        }
      }
    }

    if (newest && (!since || newest > since)) {
      await watermark.advance(mode, newest, this.now());
    }
    const summary = await report.summarise(runId);
    log.info(
      { runId, mode, firstPass: since === null, read, summary },
      "zoho artwork nightly check finished",
    );
    return { ran: true, runId, summary };
  }

  private async processProducts(
    mode: ZohoArtworkSyncMode,
    products: readonly CatalogueProduct[],
  ): Promise<ZohoArtworkSyncOutcomeInput[]> {
    const outcomes: ZohoArtworkSyncOutcomeInput[] = [];
    for (const product of products) {
      outcomes.push(await this.processProduct(mode, assessProduct(product)));
    }
    return outcomes;
  }

  private async processProduct(
    mode: ZohoArtworkSyncMode,
    assessment: ProductAssessment,
  ): Promise<ZohoArtworkSyncOutcomeInput> {
    const { register } = this.deps;
    const existing = await register.findByZohoProductId(assessment.productId);
    const holderOfStockCode =
      !existing && assessment.stockCode
        ? await register.findByStockCode(assessment.stockCode)
        : null;

    let decision = decideArtworkOutcome(assessment, { existing, holderOfStockCode });
    if (mode === "live") {
      decision = await this.apply(assessment, decision);
      await this.projectListing(assessment.productId, decision);
    }

    return toOutcome(assessment, decision);
  }

  /**
   * Brings the lax.art listing made from this record in step with what the register now holds.
   * It runs for every record Zoho touched, changed or not, so a listing missed once is put right
   * the next time. A failure is logged and does not stop the pass: the register is already right.
   */
  private async projectListing(productId: string, decision: ArtworkDecision): Promise<void> {
    const { listings, register, log } = this.deps;
    if (!listings || decision.outcome === "create" || decision.outcome === "skipped") return;
    try {
      const entry = await register.findByZohoProductId(productId);
      if (entry) await listings.project(listingFactsOf(entry));
    } catch (error) {
      log.error({ err: error, productId }, "zoho artwork could not update its lax.art listing");
    }
  }

  /** Carries a decision out on the register. A refusal turns it into a skip, never an error. */
  private async apply(
    assessment: ProductAssessment,
    decision: ArtworkDecision,
  ): Promise<ArtworkDecision> {
    const { register } = this.deps;
    const now = this.now();

    if (decision.outcome === "create" && assessment.newEntry) {
      const created = await register.create(assessment.newEntry, REGISTER_ACTOR, now);
      return created.ok ? decision : skip(`register_refused_${created.reason}`);
    }

    if ((decision.outcome === "update" || decision.outcome === "conflict") && assessment.change) {
      const applied = await register.applyZohoChange(assessment.change, now);
      if (applied.status === "not_found") return skip("register_entry_missing");
      if (applied.status === "stale") {
        return { outcome: "stale", reason: null, changes: {}, conflicts: [] };
      }
    }
    return decision;
  }
}

function skip(reason: string): ArtworkDecision {
  return { outcome: "skipped", reason, changes: {}, conflicts: [] };
}

function toOutcome(
  assessment: ProductAssessment,
  decision: ArtworkDecision,
): ZohoArtworkSyncOutcomeInput {
  const detail: Record<string, unknown> = {};
  if (assessment.gaps.length > 0) detail.gaps = assessment.gaps;
  if (assessment.blockers.length > 0) detail.blockers = assessment.blockers;
  if (Object.keys(decision.changes).length > 0) detail.changes = decision.changes;
  if (decision.conflicts.length > 0) detail.conflicts = decision.conflicts;
  if (decision.outcome === "create" && assessment.newEntry) {
    const { title, stockCode, kind, artist, medium, dimensions, year, catalogueStatus } =
      assessment.newEntry;
    detail.entry = { title, stockCode, kind, artist, medium, dimensions, year, catalogueStatus };
  }
  return {
    zohoProductId: assessment.productId,
    stockCode: assessment.stockCode,
    title: assessment.title,
    outcome: decision.outcome,
    reason: decision.reason,
    detail,
    zohoModifiedAt: assessment.modifiedAt,
  };
}
