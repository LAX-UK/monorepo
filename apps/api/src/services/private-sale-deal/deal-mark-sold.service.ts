import {
  type ArtworkRegisterEntry,
  offerRefusal,
  offerRefusalReason,
} from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  type MarkSoldOutcome,
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  dealArtworkMarkSoldRetriedEvent,
} from "@auction/domain";
import type { IPrivateSaleDealReader, ITransactionRunner } from "@auction/persistence/interfaces";
import type { PrivateSaleDealDetail } from "@auction/types";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  DealWriteResult,
  IPrivateSaleDealSettlementCommands,
} from "../interfaces/private-sale-deal-desk.js";
import type { DealLockLinks } from "./deal-lock-links.js";
import type { PrivateSaleDealQueryService } from "./deal-query.service.js";
import {
  DealArtworkRefused,
  DealRegisterUnavailable,
  type IDealRegisterLock,
  staffOrSystem,
} from "./deal-register-lock.js";
import { type DealStaffViewer, canDo, canSeeDeal } from "./deal-staff-permissions.js";

/** The register's lock and the audit trail, in one transaction. */
export type DealMarkSoldScope = {
  events: IDomainEventSink;
  register: IDealRegisterLock;
};

export type DealMarkSoldDeps = {
  deals: IPrivateSaleDealReader;
  /** The artwork, read afterwards to say where the register shows it when it would not move. */
  artworks: { findById(id: string): Promise<ArtworkRegisterEntry | null> };
  transactionRunner: ITransactionRunner;
  scopeForTx: (tx: Database) => DealMarkSoldScope;
  lockLinks: Pick<DealLockLinks, "attach">;
  records: Pick<PrivateSaleDealQueryService, "recordOf">;
};

type Attempt =
  | { kind: "done"; outcome: "marked" | "already_marked" }
  | { kind: "skipped" }
  | { kind: "failed"; message: string };

/**
 * "Try again" on a settled deal whose artwork was not recorded sold. It repeats the register's own
 * mark-sold step, which already refuses to move an artwork the register shows elsewhere, so this
 * can never overwrite another place's claim: it reports it and leaves the decision to people. The
 * step is safe to repeat, and every attempt is written to the audit log with its outcome.
 */
export class DealMarkSoldService implements IPrivateSaleDealSettlementCommands {
  constructor(private readonly deps: DealMarkSoldDeps) {}

  async markSold(viewer: DealStaffViewer, ref: string): Promise<DealWriteResult> {
    if (!canDo(viewer, "manage")) return { ok: false, error: "forbidden" };
    const deal = await this.deps.deals.findByReference(ref);
    if (!deal || !canSeeDeal(viewer, deal)) return { ok: false, error: "deal_not_found" };
    if (deal.stage !== "settled" || !deal.artworkRegisterId) {
      return { ok: false, error: "not_settled" };
    }

    const attempt = await this.deps.transactionRunner.runInTransaction((tx) =>
      this.attempt(this.deps.scopeForTx(tx), viewer, deal, deal.artworkRegisterId as string),
    );
    if (attempt.kind === "failed") {
      return { ok: false, error: "artwork_register_busy", message: attempt.message };
    }
    if (attempt.kind === "skipped") return this.refusal(deal.artworkRegisterId);
    const fresh = (await this.deps.deals.findByReference(ref)) ?? deal;
    return { ok: true, record: await this.deps.records.recordOf(viewer, fresh) };
  }

  private async attempt(
    scope: DealMarkSoldScope,
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    registerId: string,
  ): Promise<Attempt> {
    const result = await this.tryRegister(scope, viewer, deal, registerId);
    const outcome: MarkSoldOutcome =
      result.kind === "done" ? result.outcome : result.kind === "skipped" ? "skipped" : "failed";
    const event = dealArtworkMarkSoldRetriedEvent(deal, outcome);
    await scope.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: deal.id,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: viewer.userId,
      actingLegalEntityId: null,
    });
    return result;
  }

  private async tryRegister(
    scope: DealMarkSoldScope,
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    registerId: string,
  ): Promise<Attempt> {
    try {
      const status = await scope.register.markSold(
        registerId,
        deal.id,
        staffOrSystem(viewer.userId),
      );
      if (status === "skipped") return { kind: "skipped" };
      return { kind: "done", outcome: status === "moved" ? "marked" : "already_marked" };
    } catch (error) {
      if (error instanceof DealRegisterUnavailable) {
        return { kind: "failed", message: error.message };
      }
      // The register refused outright: it is shown elsewhere, exactly as a skipped move.
      if (error instanceof DealArtworkRefused) return { kind: "skipped" };
      throw error;
    }
  }

  /** The register's own reason, words and link for where the artwork is now. */
  private async refusal(registerId: string | null): Promise<DealWriteResult> {
    const entry = registerId ? await this.deps.artworks.findById(registerId) : null;
    if (!entry) return { ok: false, error: "artwork_unavailable" };
    const message = offerRefusal(offerRefusalReason(entry.offer), entry.offer.state);
    const [lock] = await this.deps.lockLinks.attach([{ entry, lock: message }]);
    return {
      ok: false,
      error: "artwork_unavailable",
      message: message.message,
      ...(lock ? { lock } : {}),
    };
  }
}
