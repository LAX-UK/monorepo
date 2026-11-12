import type {
  ArtworkOfferLock,
  OfferLockOutcome,
  OfferState,
} from "@auction/artwork-register-contracts";
import type {
  ILotRegisterLinkReader,
  IRegisterOfferConflicts,
} from "@auction/persistence/interfaces";

/** Records, in the artwork register, a lot that ATG reports sold. */
export interface AtgSoldRegisterRecorder {
  recordSold(lotId: string): Promise<AtgSoldRegisterOutcome>;
}

export type AtgSoldRegisterOutcome =
  | { status: "not_governed" }
  | { status: "unchanged" | "moved" }
  | { status: "conflict"; state: OfferState };

/** What staff read when the artwork can no longer be shown as sold on ATG. */
export function atgSoldConflictMessage(state: OfferState): string {
  if (state === "lax_art") return "Sold on ATG but now listed on lax.art";
  if (state === "sold") return "Sold on ATG but the register already shows it sold elsewhere";
  return "Sold on ATG but the register shows it offered elsewhere";
}

/**
 * The ATG result can arrive after the lot ended, when the lot-ended path has already withdrawn the
 * artwork, or while it is still offered in the sale. Either way the register moves to sold through
 * the lock's versioned write, so repeating a result changes nothing. When the artwork has since
 * been offered elsewhere the register is left alone and staff get a conflict to look at.
 */
export class AtgSoldRegisterService implements AtgSoldRegisterRecorder {
  constructor(
    private readonly lock: ArtworkOfferLock,
    private readonly links: ILotRegisterLinkReader,
    private readonly conflicts: IRegisterOfferConflicts,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recordSold(lotId: string): Promise<AtgSoldRegisterOutcome> {
    const link = await this.links.findLink(lotId);
    if (!link) return { status: "not_governed" };
    const outcome: OfferLockOutcome = await this.lock.markSold(
      { registerId: link.registerId },
      { kind: "bid_lot", id: lotId },
      "system",
    );
    if (outcome.status !== "skipped") return { status: outcome.status };
    const state = outcome.entry.offer.state;
    await this.conflicts.recordOfferConflict({
      registerId: link.registerId,
      message: atgSoldConflictMessage(state),
      state,
      lotId,
      now: this.now(),
    });
    return { status: "conflict", state };
  }
}
