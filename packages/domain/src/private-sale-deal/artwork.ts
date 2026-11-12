import type { PrivateSaleArtworkUnlinkedReason, PrivateSaleDealStage } from "@auction/types";

/** Stages in which a deal's artwork may still be linked: any before it settles or is cancelled. */
const LINKABLE_STAGES: ReadonlySet<PrivateSaleDealStage> = new Set([
  "proposed",
  "offer",
  "agreed",
  "cleared",
  "invoiced",
  "paid",
  "released",
]);

/** Stages in which the linked artwork may be swapped or taken off: until the buyer has agreed to it. */
const CHANGEABLE_STAGES: ReadonlySet<PrivateSaleDealStage> = new Set(["proposed", "offer"]);

/** Linking only adds the register's protection, so it stays open until the deal ends. */
export const canLinkArtwork = (stage: PrivateSaleDealStage): boolean => LINKABLE_STAGES.has(stage);

/**
 * Changing or removing the artwork is open only while the deal is proposed or on offer. From
 * agreement the buyer has agreed to a specific piece, so another one is a new deal.
 */
export const canChangeArtwork = (stage: PrivateSaleDealStage): boolean =>
  CHANGEABLE_STAGES.has(stage);

/** What a deal's artwork is: an original in the register, or the reason there is none. */
export type DealArtworkState = {
  artworkRegisterId: string | null;
  artworkUnlinkedReason: PrivateSaleArtworkUnlinkedReason | null;
};

/** What staff ask for: an original from the register, or the recorded reason it is not there. */
export type DealArtworkTarget =
  | { kind: "register"; artworkRegisterId: string }
  | { kind: "not_in_register"; reason: PrivateSaleArtworkUnlinkedReason };

/**
 * `record_reason` is the first note that there is no register artwork; `replace_reason` swaps one
 * recorded reason for the other, which is a change like any other and is held to the same rules.
 */
export type DealArtworkMove = "link" | "change" | "remove" | "record_reason" | "replace_reason";

export type DealArtworkRefusal =
  /** The stage no longer allows this move. */
  | "stage_locked"
  /** The artwork asked for is the one the deal already has. */
  | "unchanged";

export type DealArtworkPlan =
  | { ok: true; move: DealArtworkMove }
  | { ok: false; refusal: DealArtworkRefusal };

/**
 * What asking for `target` does to a deal's artwork, and whether its stage allows it: a first link
 * or a recorded reason while nothing is linked, a change or a removal while an artwork is held.
 * Pure: it reads nothing and writes nothing, so every screen and route applies the same rule.
 */
export function planDealArtworkMove(
  deal: { stage: PrivateSaleDealStage } & DealArtworkState,
  target: DealArtworkTarget,
): DealArtworkPlan {
  const held = deal.artworkRegisterId !== null;
  if (!held) {
    if (!canLinkArtwork(deal.stage)) return { ok: false, refusal: "stage_locked" };
    if (target.kind === "register") return { ok: true, move: "link" };
    if (deal.artworkUnlinkedReason === null) return { ok: true, move: "record_reason" };
    if (deal.artworkUnlinkedReason === target.reason) return { ok: false, refusal: "unchanged" };
    // Rewriting the reason after the buyer has agreed could undo or dodge the Agree check.
    return canChangeArtwork(deal.stage)
      ? { ok: true, move: "replace_reason" }
      : { ok: false, refusal: "stage_locked" };
  }
  if (!canChangeArtwork(deal.stage)) return { ok: false, refusal: "stage_locked" };
  if (target.kind === "register") {
    return target.artworkRegisterId === deal.artworkRegisterId
      ? { ok: false, refusal: "unchanged" }
      : { ok: true, move: "change" };
  }
  return { ok: true, move: "remove" };
}
