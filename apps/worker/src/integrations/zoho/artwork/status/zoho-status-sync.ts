import {
  type ArtworkRegisterEntry,
  deriveWhereItIs,
  zohoModuleOf,
} from "@auction/artwork-register-contracts";
import type {
  CatalogueStatusLedger,
  IArtworkRegisterRepository,
  IZohoListingLock,
  IZohoStatusSourceReader,
  RegisterStatusSource,
} from "@auction/persistence/interfaces";
import type { Logger } from "pino";
import { crmErrorOutcome } from "../../../crm/classify-crm-error.js";
import { zohoStatusForPlace } from "../writeback-mapping.js";
import { decideStatusWrite } from "./decide-status-write.js";
import {
  ZOHO_STATUS_BATCH_SIZE,
  type ZohoStatusProducts,
  type ZohoStatusState,
} from "./zoho-status-products.js";

/** `dry_run` reads and decides but sends and records nothing; `live` does both. */
export type ZohoStatusSyncMode = "dry_run" | "live";

type Subject = { registerId: string; stockCode: string; zohoProductId: string };

/** What happened to one record. In a dry run `written` means "would have been written". */
export type StatusOutcome = Subject &
  (
    | { kind: "written"; status: string }
    | { kind: "in_sync" }
    /** Zoho shows `zohoStatus`, which LAX did not write; LAX would set `wanted`. */
    | { kind: "conflict"; zohoStatus: string; wanted: string }
    /** Zoho changed after the facts were read, or between the read and the write: left for the next run. */
    | { kind: "stale" }
    | { kind: "skipped"; reason: "register_entry_missing" | "print_group_not_a_product" }
    | { kind: "failed"; code: string; retryable: boolean }
  );

export type StatusSyncFailure = {
  registerId: string;
  stockCode?: string;
  code: string;
  retryable: boolean;
};

export type StatusSyncReport = {
  checked: number;
  /** Sent to Zoho, or in a dry run, would have been. */
  written: number;
  unchanged: number;
  /** Left alone because Zoho shows a Status LAX did not write. */
  conflicts: number;
  /** Dropped because Zoho changed after the facts were read. */
  stale: number;
  failures: StatusSyncFailure[];
};

export const EMPTY_STATUS_REPORT: StatusSyncReport = {
  checked: 0,
  written: 0,
  unchanged: 0,
  conflicts: 0,
  stale: 0,
  failures: [],
};

export function addStatusReports(a: StatusSyncReport, b: StatusSyncReport): StatusSyncReport {
  return {
    checked: a.checked + b.checked,
    written: a.written + b.written,
    unchanged: a.unchanged + b.unchanged,
    conflicts: a.conflicts + b.conflicts,
    stale: a.stale + b.stale,
    failures: [...a.failures, ...b.failures],
  };
}

export function reportOf(outcomes: readonly StatusOutcome[]): StatusSyncReport {
  const report: StatusSyncReport = { ...EMPTY_STATUS_REPORT, failures: [] };
  report.checked = outcomes.length;
  for (const outcome of outcomes) {
    if (outcome.kind === "written") report.written += 1;
    else if (outcome.kind === "conflict") report.conflicts += 1;
    else if (outcome.kind === "stale") report.stale += 1;
    else if (outcome.kind === "failed") {
      report.failures.push({
        registerId: outcome.registerId,
        stockCode: outcome.stockCode,
        code: outcome.code,
        retryable: outcome.retryable,
      });
    } else report.unchanged += 1;
  }
  return report;
}

export type ZohoStatusSyncDeps = {
  mode: ZohoStatusSyncMode;
  sources: Pick<IZohoStatusSourceReader, "readStatusSources">;
  register: Pick<
    IArtworkRegisterRepository,
    | "findCatalogueStatusLedgers"
    | "recordCatalogueStatusWritten"
    | "closeCatalogueStatusConflict"
    | "recordCatalogueStatusConflict"
  >;
  products: ZohoStatusProducts;
  lock: IZohoListingLock;
  log: Logger;
  now?: () => Date;
};

/**
 * Zoho stamps Modified_Time on its clock and `observedAt` is the worker's. A Product modified up to
 * this long "after" the read is taken to be clock skew, not a newer change; the re-read just before
 * the write (`sameState`) still catches a real one.
 */
export const CLOCK_SKEW_TOLERANCE_MS = 5_000;

const NO_LEDGER: CatalogueStatusLedger = { written: null, conflictOpen: false };

/**
 * Brings the Zoho Status into line with where LAX shows the artwork, without overwriting what
 * staff set in Zoho. One path for the register events and the nightly pass, so they cannot differ.
 *
 * Per batch, under the artworks' locks: read the register facts (after the locks, so they are the
 * newest), read the Status Zoho shows, then decide with compare-and-set (`decideStatusWrite`).
 * A Status is sent only when Zoho shows nothing, the Status LAX last wrote, or Available; any
 * other value is left alone and raised as a conflict for staff. What was sent is recorded, so the
 * next compare knows it. Sending twice sends once, and a Product Zoho changed after the facts were
 * read is left for the next pass, so an older picture never goes over a newer one. Just before a
 * write the Product is read again and its Status and Modified_Time must match the read the decision
 * was made on; if not, nothing is sent. Zoho cannot make the write itself conditional, so a change
 * in the few milliseconds between that read and the write remains (docs/integrations/zoho.md).
 */
export class ZohoStatusSync {
  private readonly now: () => Date;

  constructor(private readonly deps: ZohoStatusSyncDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** The outcome of each record, in batches of the COQL limit. Throws when Zoho cannot be read. */
  async sync(registerIds: readonly string[]): Promise<StatusOutcome[]> {
    const ids = [...new Set(registerIds)];
    const outcomes: StatusOutcome[] = [];
    for (let at = 0; at < ids.length; at += ZOHO_STATUS_BATCH_SIZE) {
      const batch = ids.slice(at, at + ZOHO_STATUS_BATCH_SIZE);
      outcomes.push(...(await this.deps.lock.withLock(batch, () => this.syncBatch(batch))));
    }
    return outcomes;
  }

  private async syncBatch(registerIds: string[]): Promise<StatusOutcome[]> {
    const observedAt = this.now();
    const sources = await this.deps.sources.readStatusSources(registerIds);
    const found = new Set(sources.map((source) => source.entry.id));
    const outcomes: StatusOutcome[] = registerIds
      .filter((id) => !found.has(id))
      .map((registerId) => ({
        registerId,
        stockCode: "",
        zohoProductId: "",
        kind: "skipped" as const,
        reason: "register_entry_missing" as const,
      }));

    const products = sources.filter(({ entry }) => zohoModuleOf(entry) === "Products");
    for (const { entry } of sources) {
      if (zohoModuleOf(entry) === "Print_Products") {
        outcomes.push({ ...subject(entry), kind: "skipped", reason: "print_group_not_a_product" });
      }
    }
    if (products.length === 0) return outcomes;

    const [shown, ledgers] = await Promise.all([
      this.deps.products.read(products.map(({ entry }) => entry.zohoProductId)),
      this.deps.register.findCatalogueStatusLedgers(products.map(({ entry }) => entry.id)),
    ]);
    for (const source of products) {
      const state = shown.get(source.entry.zohoProductId);
      const ledger = ledgers.get(source.entry.id) ?? NO_LEDGER;
      outcomes.push(await this.settle(source, state, ledger, observedAt));
    }
    return outcomes;
  }

  private async settle(
    source: RegisterStatusSource,
    state: ZohoStatusState | undefined,
    ledger: CatalogueStatusLedger,
    observedAt: Date,
  ): Promise<StatusOutcome> {
    const { entry } = source;
    const who = subject(entry);
    if (!state) {
      return { ...who, kind: "failed", code: "product_not_found", retryable: false };
    }
    if (
      state.modifiedAt &&
      state.modifiedAt.getTime() > observedAt.getTime() + CLOCK_SKEW_TOLERANCE_MS
    ) {
      return { ...who, kind: "stale" };
    }

    const wanted = wantedStatus(source, observedAt);
    const decision = decideStatusWrite({
      wanted,
      zohoStatus: state.status,
      lastWritten: ledger.written,
    });
    const live = this.deps.mode === "live";
    try {
      if (decision.kind === "conflict") {
        if (live) {
          await this.deps.register.recordCatalogueStatusConflict({
            registerId: entry.id,
            zohoStatus: decision.zohoStatus,
            laxStatus: wanted,
            zohoModifiedAt: state.modifiedAt ?? observedAt,
            now: this.now(),
          });
        }
        this.deps.log.info(
          { registerId: entry.id, zohoStatus: decision.zohoStatus, wanted, dryRun: !live },
          "zoho_status_conflict",
        );
        return { ...who, kind: "conflict", zohoStatus: decision.zohoStatus, wanted };
      }

      if (decision.kind === "write") {
        if (!live) {
          this.deps.log.info(
            { registerId: entry.id, zohoStatus: state.status, wanted },
            "zoho_status_dry_run",
          );
          return { ...who, kind: "written", status: wanted };
        }
        // Zoho has no conditional update, so the nearest thing to compare-and-set is to read the
        // Product again immediately before sending and give way if it is not the one decided on.
        const latest = (await this.deps.products.read([entry.zohoProductId])).get(
          entry.zohoProductId,
        );
        if (!latest) {
          return { ...who, kind: "failed", code: "product_not_found", retryable: false };
        }
        if (!sameState(state, latest)) {
          this.deps.log.info({ registerId: entry.id, wanted }, "zoho_status_changed_before_write");
          return { ...who, kind: "stale" };
        }
        await this.deps.products.write(entry.zohoProductId, wanted);
      }

      if (live && decision.kind === "write") {
        await this.deps.register.recordCatalogueStatusWritten({
          registerId: entry.id,
          status: wanted,
          now: this.now(),
        });
      } else if (live && ledger.conflictOpen) {
        // Zoho already shows what LAX wants, but LAX did not send it, so it is not "last written":
        // it may be staff's Sold or Reserved. Only the open conflict is closed.
        await this.deps.register.closeCatalogueStatusConflict({
          registerId: entry.id,
          now: this.now(),
        });
      }
      return decision.kind === "write"
        ? { ...who, kind: "written", status: wanted }
        : { ...who, kind: "in_sync" };
    } catch (err) {
      const { retryable, error } = crmErrorOutcome(err);
      return { ...who, kind: "failed", code: error.code, retryable };
    }
  }
}

/** The same Status, last changed at the same moment: nothing happened to the Product in between. */
function sameState(a: ZohoStatusState, b: ZohoStatusState): boolean {
  return (
    a.status === b.status && (a.modifiedAt?.getTime() ?? null) === (b.modifiedAt?.getTime() ?? null)
  );
}

/**
 * The Status LAX wants, from the same "Where it is" place LAX Admin draws. A withdrawn artwork
 * reads Withdrawn for 30 days from its last move, then as not offered (Available).
 */
export function wantedStatus(source: RegisterStatusSource, now: Date): string {
  const { entry, lastMove } = source;
  const withdrawn =
    entry.offer.state === "withdrawn" && lastMove?.to === "withdrawn"
      ? { at: lastMove.at, from: null }
      : null;
  return zohoStatusForPlace(deriveWhereItIs({ offer: entry.offer, now, withdrawn }).key);
}

function subject(entry: ArtworkRegisterEntry): Subject {
  return { registerId: entry.id, stockCode: entry.stockCode, zohoProductId: entry.zohoProductId };
}
