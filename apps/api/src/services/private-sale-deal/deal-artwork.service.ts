import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  type DealArtworkMove,
  type DealArtworkTarget,
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  canChangeArtwork,
  dealArtworkMovedEvent,
  planDealArtworkMove,
} from "@auction/domain";
import type {
  IPrivateSaleDealReader,
  IPrivateSaleDealWriter,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type {
  PrivateSaleArtworkAction,
  PrivateSaleArtworkUnlinkedReason,
  PrivateSaleDealDetail,
} from "@auction/types";
import type { AdminDealArtworkRemoveInput, AdminDealArtworkSetInput } from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  DealWriteResult,
  IPrivateSaleDealArtworkCommands,
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

/** The reads, writes and events one artwork change uses, so they share a transaction. */
export type DealArtworkScope = {
  deals: IPrivateSaleDealReader & IPrivateSaleDealWriter;
  events: IDomainEventSink;
  register: IDealRegisterLock;
};

export type DealArtworkDeps = {
  deals: IPrivateSaleDealReader;
  /** The artworks in the register, to check one exists and is an original before it is held. */
  artworks: { findById(id: string): Promise<ArtworkRegisterEntry | null> };
  transactionRunner: ITransactionRunner;
  scopeForTx: (tx: Database) => DealArtworkScope;
  lockLinks: Pick<DealLockLinks, "attach">;
  records: Pick<PrivateSaleDealQueryService, "recordOf">;
};

/** Thrown inside the transaction so nothing is kept when the deal moved on since it was read. */
class DealMovedOn extends Error {}

type Plan = {
  move: DealArtworkMove;
  target: DealArtworkTarget;
  /** The artwork held now, released when the move replaces or removes it. */
  held: string | null;
  note: string | null;
};

const ACTION: Record<DealArtworkMove, PrivateSaleArtworkAction> = {
  link: "linked",
  record_reason: "linked",
  change: "changed",
  replace_reason: "changed",
  remove: "removed",
};

/**
 * Staff link, change or take off a deal's artwork. The register's one-place-at-a-time lock is the
 * authority on whether the artwork can be held, so the deal's change, the lock's hold and release,
 * the history line and the audit event all commit together or not at all: if the register refuses
 * the new artwork, the old one is still held and nothing has changed. The stage rules are the
 * domain's; this carries them out.
 */
export class DealArtworkService implements IPrivateSaleDealArtworkCommands {
  constructor(private readonly deps: DealArtworkDeps) {}

  async set(
    viewer: DealStaffViewer,
    ref: string,
    input: AdminDealArtworkSetInput,
  ): Promise<DealWriteResult> {
    if (!canDo(viewer, "manage")) return { ok: false, error: "forbidden" };
    // Exactly one: the artwork in the register, or why it is not there.
    if ((input.artworkRegisterId !== undefined) === (input.notInRegister !== undefined)) {
      return { ok: false, error: "artwork_choice_required" };
    }
    const target: DealArtworkTarget = input.artworkRegisterId
      ? { kind: "register", artworkRegisterId: input.artworkRegisterId }
      : {
          kind: "not_in_register",
          reason: (input.notInRegister as { reason: PrivateSaleArtworkUnlinkedReason }).reason,
        };
    return this.apply(viewer, ref, input.version, target, input.reason ?? null);
  }

  async remove(
    viewer: DealStaffViewer,
    ref: string,
    input: AdminDealArtworkRemoveInput,
  ): Promise<DealWriteResult> {
    if (!canDo(viewer, "manage")) return { ok: false, error: "forbidden" };
    const target: DealArtworkTarget = {
      kind: "not_in_register",
      reason: input.notInRegister.reason,
    };
    return this.apply(viewer, ref, input.version, target, input.reason ?? null, "remove");
  }

  private async apply(
    viewer: DealStaffViewer,
    ref: string,
    version: number,
    target: DealArtworkTarget,
    note: string | null,
    expected?: DealArtworkMove,
  ): Promise<DealWriteResult> {
    const deal = await this.deps.deals.findByReference(ref);
    if (!deal || !canSeeDeal(viewer, deal)) return { ok: false, error: "deal_not_found" };
    if (deal.version !== version) {
      return { ok: false, error: "stale_version", currentVersion: deal.version };
    }
    const planned = planDealArtworkMove(deal, target);
    if (!planned.ok) {
      return {
        ok: false,
        error: planned.refusal === "stage_locked" ? "artwork_locked" : "artwork_unchanged",
      };
    }
    // Removing is only ever asked for on a held artwork; recording a reason is not a removal.
    if (expected && planned.move !== expected) return { ok: false, error: "artwork_unchanged" };
    if ((planned.move === "change" || planned.move === "replace_reason") && note === null)
      return { ok: false, error: "reason_required" };
    // Once the buyer has agreed, recording a first reason changes what the Agree check saw: say why.
    if (
      planned.move === "record_reason" &&
      !canChangeArtwork(deal.stage) &&
      (note === null || note.trim() === "")
    )
      return { ok: false, error: "reason_required" };

    const entry =
      target.kind === "register"
        ? await this.deps.artworks.findById(target.artworkRegisterId)
        : null;
    if (target.kind === "register") {
      if (!entry) return { ok: false, error: "artwork_not_found" };
      if (entry.kind !== "original") return { ok: false, error: "artwork_not_original" };
    }

    const plan: Plan = { move: planned.move, target, held: deal.artworkRegisterId, note };
    try {
      const written = await this.deps.transactionRunner.runInTransaction((tx) =>
        this.carryOut(this.deps.scopeForTx(tx), viewer, deal, plan),
      );
      return { ok: true, record: await this.deps.records.recordOf(viewer, written) };
    } catch (error) {
      return this.refusalOf(error, entry, ref);
    }
  }

  private async carryOut(
    scope: DealArtworkScope,
    viewer: DealStaffViewer,
    deal: PrivateSaleDealDetail,
    plan: Plan,
  ): Promise<PrivateSaleDealDetail> {
    const toId = plan.target.kind === "register" ? plan.target.artworkRegisterId : null;
    const toReason = plan.target.kind === "not_in_register" ? plan.target.reason : null;
    const actor = staffOrSystem(viewer.userId);
    // The register row goes first. Writing the deal's foreign key takes a shared lock on the artwork
    // row, and two deals doing that at once would each then wait to upgrade it (a deadlock). Holding
    // the artwork first takes the exclusive lock up front, so competing deals simply take turns.
    // A stale deal version rolls the hold back with the rest of the transaction.
    if (toId) await scope.register.offer(toId, deal.id, actor);
    const written = await scope.deals.setArtwork(deal.id, deal.version, {
      action: ACTION[plan.move],
      actorUserId: viewer.userId,
      artworkRegisterId: toId,
      unlinkedReason: toReason,
      reason: plan.note,
    });
    if (written.kind !== "ok") throw new DealMovedOn();
    // Release the old artwork only once the new one is held and the deal points at it.
    if (plan.held && plan.move !== "link") await scope.register.withdraw(plan.held, deal.id, actor);

    const event = dealArtworkMovedEvent(deal, plan.move, {
      from: {
        artworkRegisterId: deal.artworkRegisterId,
        unlinkedReason: deal.artworkUnlinkedReason,
      },
      to: { artworkRegisterId: toId, unlinkedReason: toReason },
    });
    await scope.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: deal.id,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId: viewer.userId,
      actingLegalEntityId: null,
    });
    return written.deal;
  }

  private async refusalOf(
    error: unknown,
    entry: ArtworkRegisterEntry | null,
    ref: string,
  ): Promise<DealWriteResult> {
    if (error instanceof DealMovedOn) {
      // Someone changed the deal between reading it and writing: say which version it is at now.
      const current = await this.deps.deals.findByReference(ref);
      return {
        ok: false,
        error: "stale_version",
        ...(current ? { currentVersion: current.version } : {}),
      };
    }
    if (error instanceof DealArtworkRefused) {
      // Only holding an artwork is refused, and then the artwork is known; without it the link has no address.
      const [lock] = entry
        ? await this.deps.lockLinks.attach([{ entry, lock: error.lock }])
        : [{ ...error.lock, link: error.lock.link ? { ...error.lock.link, href: null } : null }];
      return {
        ok: false,
        error: "artwork_unavailable",
        message: error.message,
        ...(lock ? { lock } : {}),
      };
    }
    if (error instanceof DealRegisterUnavailable) {
      return { ok: false, error: "artwork_register_busy", message: error.message };
    }
    throw error;
  }
}
