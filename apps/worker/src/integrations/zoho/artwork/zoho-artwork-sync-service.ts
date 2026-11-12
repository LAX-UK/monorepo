import type {
  IArtworkImageStore,
  IArtworkRegisterRepository,
} from "@auction/persistence/interfaces";
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
import type { ImageSyncReport } from "./images/zoho-image-sync.service.js";
import type { SoldWhileLiveReconciler } from "./sold-while-live-monitor.js";
import type { ZohoCatalogueReader } from "./zoho-catalogue-reader.js";

/** The picture side of the sync: what the service needs, not how pictures are fetched or stored. */
export interface ZohoProductImages {
  syncProduct(productId: string, mode: ZohoArtworkSyncMode): Promise<ImageSyncReport>;
}

/** `off` does nothing; `dry_run` reports what would change; `live` changes the register. */
export type ZohoArtworkSyncModeSetting = "off" | ZohoArtworkSyncMode;

export type ZohoArtworkSyncDeps = {
  mode: ZohoArtworkSyncModeSetting;
  reader: ZohoCatalogueReader;
  images: ZohoProductImages;
  register: IArtworkRegisterRepository;
  imageCheck: IArtworkImageStore;
  report: IZohoArtworkSyncReport;
  watermark: IZohoArtworkSyncWatermark;
  /**
   * Raises a staff item when Zoho says Sold or Reserved on an artwork still for sale. Only runs
   * live; absent where the check is not wired.
   */
  soldWhileLive?: SoldWhileLiveReconciler;
  log: Logger;
  now?: () => Date;
};

export type ZohoArtworkSyncRunResult =
  | { ran: false; reason: "mode_off" }
  | { ran: true; runId: string; summary: ZohoArtworkSyncSummary };

const REGISTER_ACTOR = "zoho";

/**
 * Zoho does not always move a Product's modified time when a picture is added or replaced, so
 * pictures are also compared on a schedule of their own: each record at least this often.
 */
const IMAGE_RECHECK_AFTER_MS = 20 * 60 * 60 * 1000;
/** The most records re-checked for pictures in one nightly pass, oldest check first. */
const IMAGE_RECHECK_LIMIT = 300;

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
      : [await this.deletedInZoho(input.productId)];
    await report.record(input.runId, mode, outcomes, this.now());
    return { ran: true, runId: input.runId, summary: await report.summarise(input.runId) };
  }

  /**
   * The Product is gone from Zoho. Nothing in LAX is withdrawn or changed; the outcome names the
   * record so staff can see it under "Deleted in Zoho" and decide.
   */
  private async deletedInZoho(productId: string): Promise<ZohoArtworkSyncOutcomeInput> {
    const entry = await this.deps.register.findByZohoProductId(productId);
    return {
      zohoProductId: productId,
      stockCode: entry?.stockCode ?? null,
      title: entry?.title ?? null,
      outcome: "skipped",
      reason: "not_found_in_zoho",
      detail: {},
      zohoModifiedAt: null,
    };
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
    const images = await this.recheckPictures(mode, startedAt);
    await this.sweepSoldWhileLive(mode);
    const summary = await report.summarise(runId);
    log.info(
      { runId, mode, firstPass: since === null, read, summary, images },
      "zoho artwork nightly check finished",
    );
    return { ran: true, runId, summary };
  }

  /**
   * Compares the pictures of records not checked recently, which catches pictures changed in Zoho
   * without the Product's modified time moving, and retries any that could not be fetched before.
   * A problem with one record never stops the others.
   */
  private async recheckPictures(
    mode: ZohoArtworkSyncMode,
    startedAt: Date,
  ): Promise<{ checked: number; changed: number; unavailable: number }> {
    const { imageCheck, images, log } = this.deps;
    const before = new Date(startedAt.getTime() - IMAGE_RECHECK_AFTER_MS);
    const due = await imageCheck.listImageCheckCandidates(before, IMAGE_RECHECK_LIMIT);
    const totals = { checked: 0, changed: 0, unavailable: 0 };
    for (const candidate of due) {
      try {
        const result = await images.syncProduct(candidate.zohoProductId, mode);
        totals.checked += 1;
        if (result.changed) totals.changed += 1;
        if (result.status === "unavailable" || result.failed > 0) totals.unavailable += 1;
      } catch (error) {
        totals.unavailable += 1;
        log.warn({ err: error, productId: candidate.zohoProductId }, "zoho picture check failed");
      }
    }
    return totals;
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
      await this.checkSoldWhileLive(assessment.productId);
    }

    const kind = existing?.kind ?? assessment.newEntry?.kind;
    const pictures =
      kind === "original" && decision.outcome !== "skipped"
        ? await this.checkPictures(mode, assessment.productId)
        : null;
    return toOutcome(assessment, decision, pictures);
  }

  /**
   * Looks at the artwork as the register now holds it. A problem here never fails the Product:
   * the next change or the nightly sweep looks again.
   */
  private async checkSoldWhileLive(productId: string): Promise<void> {
    const { soldWhileLive, register, log } = this.deps;
    if (!soldWhileLive) return;
    try {
      const entry = await register.findByZohoProductId(productId);
      if (entry) await soldWhileLive.reconcile(entry, this.now());
    } catch (error) {
      log.warn({ err: error, productId }, "zoho sold-while-live check failed");
    }
  }

  private async sweepSoldWhileLive(mode: ZohoArtworkSyncModeSetting): Promise<void> {
    const { soldWhileLive, log } = this.deps;
    if (mode !== "live" || !soldWhileLive) return;
    try {
      await soldWhileLive.sweep(this.now());
    } catch (error) {
      log.warn({ err: error }, "zoho sold-while-live sweep failed");
    }
  }

  /** Only originals carry pictures to lax.art. A failure here never fails the Product itself. */
  private async checkPictures(
    mode: ZohoArtworkSyncMode,
    productId: string,
  ): Promise<ImageSyncReport | null> {
    try {
      return await this.deps.images.syncProduct(productId, mode);
    } catch (error) {
      this.deps.log.warn({ err: error, productId }, "zoho pictures could not be synced");
      return null;
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
  pictures: ImageSyncReport | null,
): ZohoArtworkSyncOutcomeInput {
  const detail: Record<string, unknown> = {};
  if (assessment.gaps.length > 0) detail.gaps = assessment.gaps;
  if (assessment.blockers.length > 0) detail.blockers = assessment.blockers;
  if (Object.keys(decision.changes).length > 0) detail.changes = decision.changes;
  if (decision.conflicts.length > 0) detail.conflicts = decision.conflicts;
  if (pictures) detail.images = pictures;
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
