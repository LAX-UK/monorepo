import {
  type ArtworkRegisterEntry,
  assessSoldWhileLive,
  decideSoldWhileLive,
} from "@auction/artwork-register-contracts";
import type {
  IArtworkRegisterReader,
  ISoldAttentionStore,
  RaiseSoldAttentionInput,
  SoldAttentionLiveCursor,
} from "@auction/persistence/interfaces";

export type SoldWhileLiveOutcome = "none" | "raised" | "resolved" | "replaced";

/** What the sync needs from the check: look at one artwork, and sweep the ones already held. */
export interface SoldWhileLiveReconciler {
  reconcile(entry: ArtworkRegisterEntry, now: Date): Promise<SoldWhileLiveOutcome>;
  /** Closes items whose situation has ended, for example a listing staff withdrew. */
  sweep(now: Date, limit?: number): Promise<number>;
}

const SWEEP_LIMIT = 500;

/**
 * Zoho is the source of truth for Sold and Reserved. When it says either on an artwork LAX still
 * has for sale, a staff item is raised and new money pauses; nothing is withdrawn by itself. When
 * Zoho goes back to Available (or the listing is withdrawn) the item closes by itself. The rules
 * are in the contract; this applies them to the store.
 */
export class SoldWhileLiveMonitor implements SoldWhileLiveReconciler {
  constructor(
    private readonly attention: ISoldAttentionStore,
    private readonly register: Pick<IArtworkRegisterReader, "findById">,
  ) {}

  async reconcile(entry: ArtworkRegisterEntry, now: Date): Promise<SoldWhileLiveOutcome> {
    const live = await this.attention.findLive(entry.id);
    const decision = decideSoldWhileLive({
      item: live ? { status: live.zohoStatus, state: live.status as "open" | "overridden" } : null,
      situation: assessSoldWhileLive(entry),
      statusNow: entry.catalogueStatus,
      offerState: entry.offer.state,
    });
    switch (decision.action) {
      case "none":
        return "none";
      case "resolve":
        return live &&
          (await this.attention.resolve({ id: live.id, resolution: decision.resolution, now }))
          ? "resolved"
          : "none";
      case "raise":
        return (await this.attention.raise(raiseInput(entry, decision.situation, now))).raised
          ? "raised"
          : "none";
      case "replace":
        // One transaction, so no moment has nothing open and money unpaused between the two items.
        if (live) {
          return (await this.attention.replace({
            id: live.id,
            now,
            raise: raiseInput(entry, decision.situation, now),
          }))
            ? "replaced"
            : "none";
        }
        return (await this.attention.raise(raiseInput(entry, decision.situation, now))).raised
          ? "replaced"
          : "none";
    }
  }

  /** Pages through every live item, so a backlog of more than one page is still looked at. */
  async sweep(now: Date, limit = SWEEP_LIMIT): Promise<number> {
    let closed = 0;
    let after: SoldAttentionLiveCursor | undefined;
    for (;;) {
      const page = await this.attention.listLive(limit, after);
      for (const ref of page) {
        const entry = await this.register.findById(ref.registerId);
        if (entry && (await this.reconcile(entry, now)) === "resolved") closed += 1;
      }
      const last = page.at(-1);
      if (!last || page.length < limit) return closed;
      after = { raisedAt: last.raisedAt, id: last.id };
    }
  }
}

function raiseInput(
  entry: ArtworkRegisterEntry,
  situation: NonNullable<ReturnType<typeof assessSoldWhileLive>>,
  now: Date,
): RaiseSoldAttentionInput {
  return {
    registerId: entry.id,
    zohoProductId: entry.zohoProductId,
    zohoStatus: situation.status,
    place: situation.place,
    placeRefId: entry.offer.ref?.id ?? null,
    markedAt: entry.zohoModifiedAt ?? now,
    now,
  };
}
