import {
  type ArtworkRegisterEntry,
  assessSoldWhileLive,
  decideSoldWhileLive,
} from "@auction/artwork-register-contracts";
import type { IArtworkRegisterReader, ISoldAttentionStore } from "@auction/persistence/interfaces";

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
        return (await this.raise(entry, decision.situation, now)) ? "raised" : "none";
      case "replace":
        if (live) await this.attention.resolve({ id: live.id, resolution: "replaced", now });
        return (await this.raise(entry, decision.situation, now)) ? "replaced" : "none";
    }
  }

  async sweep(now: Date, limit = SWEEP_LIMIT): Promise<number> {
    let closed = 0;
    for (const registerId of await this.attention.listLiveRegisterIds(limit)) {
      const entry = await this.register.findById(registerId);
      if (entry && (await this.reconcile(entry, now)) === "resolved") closed += 1;
    }
    return closed;
  }

  private async raise(
    entry: ArtworkRegisterEntry,
    situation: NonNullable<ReturnType<typeof assessSoldWhileLive>>,
    now: Date,
  ): Promise<boolean> {
    const result = await this.attention.raise({
      registerId: entry.id,
      zohoProductId: entry.zohoProductId,
      zohoStatus: situation.status,
      place: situation.place,
      placeRefId: entry.offer.ref?.id ?? null,
      markedAt: entry.zohoModifiedAt ?? now,
      now,
    });
    return result.raised;
  }
}
