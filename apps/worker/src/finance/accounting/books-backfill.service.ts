import { type Product, booksTargetMode, documentTarget } from "@auction/accounting-domain";
import type { IAccountingSourceSettingReader } from "@auction/persistence/interfaces";
import type { IBooksHistoryReader } from "../../repositories/drizzle-books-history.reader.js";
import { ACCOUNTING_EVENT_ROUTES, type AccountingEventRoute } from "./accounting-event-routes.js";
import {
  type AccountingProjection,
  AccountingProjectionRefusedError,
} from "./accounting-projection.service.js";

/** Events one run projects at most, whatever is asked: the sender works through them after. */
export const BACKFILL_MAX_LIMIT = 500;
export const BACKFILL_DEFAULT_LIMIT = 200;

export interface BooksBackfillInput {
  readonly product: Product;
  /**
   * The cutover: the moment the product went to Books live. A window may not start before it:
   * what happened earlier belongs to the Xero path that was still booking it (Bid's history
   * never comes to Books, and an imported Shop sale must not be booked a second time).
   */
  readonly notBefore: Date;
  readonly from: Date;
  readonly to: Date;
  /** Resume after this event id (the `next` of the previous run). */
  readonly afterId: number | null;
  readonly limit?: number;
  /**
   * The unsent documents the target may hold: a run stops (to be run again later) once the queue
   * is this long, so live documents are never left waiting behind a backlog.
   */
  readonly maxUnsent: number;
  readonly dryRun: boolean;
}

export interface BooksBackfillReport {
  readonly dryRun: boolean;
  readonly product: Product;
  readonly events: number;
  readonly projected: number;
  readonly created: number;
  /** Dry run only: documents a real run would create, and those already held. */
  readonly wouldCreate: number;
  readonly replayed: number;
  readonly skipped: number;
  readonly refused: readonly { readonly eventId: number; readonly reason: string }[];
  /** An event that must wait (something still being sent), or the queue is full: run again later from `next`. */
  readonly waiting: { readonly eventId: number; readonly reason: string } | null;
  /** The `--after` of the next run; null when the window is done. */
  readonly next: number | null;
}

export class BooksBackfillRefusedError extends Error {
  constructor(readonly code: string) {
    super(`books_backfill_refused:${code}`);
    this.name = "BooksBackfillRefusedError";
  }
}

export interface BooksBackfillDeps {
  readonly history: IBooksHistoryReader;
  readonly projection: Pick<AccountingProjection, "project" | "plan">;
  readonly settings: IAccountingSourceSettingReader;
  readonly routes?: Readonly<Record<string, AccountingEventRoute>>;
}

/**
 * Projects again one product's domain events in a window, under the switch as it is now, so what
 * LAX should have sent while Books was off or in dry run is queued for the current Books target and
 * sent by the sender like any new document. Same projection, same registry, same guards: a replay
 * changes nothing. At most `BACKFILL_MAX_LIMIT` events a run, resumed from `next`.
 */
export class BooksBackfill {
  constructor(private readonly deps: BooksBackfillDeps) {}

  async run(input: BooksBackfillInput): Promise<BooksBackfillReport> {
    if (input.from < input.notBefore) throw new BooksBackfillRefusedError("before_cutover");
    if (!(input.from < input.to)) throw new BooksBackfillRefusedError("empty_window");
    const limit = Math.min(Math.max(1, input.limit ?? BACKFILL_DEFAULT_LIMIT), BACKFILL_MAX_LIMIT);
    const config = await this.deps.settings.read();
    if (!config.ok) throw new BooksBackfillRefusedError(`switch_${config.refusal.code}`);
    const switchState = config.value[input.product];
    const mode = booksTargetMode(switchState);
    if (mode === null) throw new BooksBackfillRefusedError("product_not_aimed_at_books");
    if (mode === "live") throw new BooksBackfillRefusedError("books_live_not_in_rehearsal");

    const routes = this.deps.routes ?? ACCOUNTING_EVENT_ROUTES;
    // Only the product's own event types: a Shop backfill never reads a Bid event, nor the reverse.
    const eventTypes = Object.entries(routes)
      .filter(([, route]) => route.product === input.product)
      .map(([type]) => type);
    const events = await this.deps.history.eventsInWindow({
      eventTypes,
      from: input.from,
      to: input.to,
      afterId: input.afterId,
      limit,
    });

    let projected = 0;
    const target = documentTarget(switchState);
    let created = 0;
    let wouldCreate = 0;
    let replayed = 0;
    let skipped = 0;
    const refused: { eventId: number; reason: string }[] = [];
    let waiting: { eventId: number; reason: string } | null = null;
    let last = input.afterId;
    for (const event of events) {
      if (!input.dryRun && target !== null) {
        // Counted before each event, so documents the sender has not taken yet are never piled up.
        const unsent = await this.deps.history.unsentDocuments({
          product: input.product,
          provider: target.provider,
          mode: target.mode,
        });
        if (unsent >= input.maxUnsent) {
          waiting = { eventId: event.id, reason: "queue_full" };
          break;
        }
      }
      try {
        if (input.dryRun) {
          const plan = await this.deps.projection.plan(event);
          if (plan.outcome === "skipped") skipped += 1;
          else {
            projected += 1;
            wouldCreate += plan.wouldCreate;
            replayed += plan.existing;
          }
          last = event.id;
          continue;
        }
        const outcome = await this.deps.projection.project(event);
        if (outcome.outcome === "skipped") skipped += 1;
        else {
          projected += 1;
          created += outcome.created;
          replayed += outcome.replayed + outcome.kept;
        }
      } catch (error) {
        if (!(error instanceof AccountingProjectionRefusedError)) {
          // Not yet, or a fault: stop here so the next run starts with this event.
          waiting = { eventId: event.id, reason: error instanceof Error ? error.message : "error" };
          break;
        }
        refused.push({ eventId: event.id, reason: error.code });
      }
      last = event.id;
    }
    const done = waiting === null && events.length < limit;
    return {
      dryRun: input.dryRun,
      product: input.product,
      events: events.length,
      projected,
      created,
      wouldCreate,
      replayed,
      skipped,
      refused,
      waiting,
      next: done ? null : (last ?? 0),
    };
  }
}
