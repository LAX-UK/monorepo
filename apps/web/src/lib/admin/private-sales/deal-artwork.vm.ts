import type { DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import { type WhereItIsChipSpec, formatStaffDateTime } from "@auction/staff-ui";
import type { PrivateSaleDealStage } from "@auction/types";

/** What the Artwork section says about where a deal's artwork is, in the words every product uses. */
export type ArtworkSectionLine = {
  chip: WhereItIsChipSpec;
  lead: string;
  trail?: string;
  note: string;
};

const NOT_IN_REGISTER: WhereItIsChipSpec = {
  label: "Not in the register",
  tone: "neutral",
  marker: "hollow",
};
const NOT_LINKED: WhereItIsChipSpec = { label: "Not linked", tone: "warning", marker: "hollow" };

/** The words when no register artwork is linked: the seller's own work, or a note that it still has to be linked. */
export function unlinkedLine(deal: Pick<DealRecord, "artworkUnlinkedReason">): ArtworkSectionLine {
  if (deal.artworkUnlinkedReason === "sellers_own_work") {
    return {
      chip: NOT_IN_REGISTER,
      lead: "The seller's own work",
      note: "The gallery doesn't hold it, so nothing in Zoho or on lax.art can sell it. No hold is needed.",
    };
  }
  return {
    chip: NOT_LINKED,
    lead: "Not linked to the register",
    note: "Nothing stops this artwork being offered somewhere else. Link it to hold it for this deal. The deal can't be agreed until it is linked.",
  };
}

const HELD_NOTE: Partial<Record<PrivateSaleDealStage, string>> = {
  proposed: "Nothing else can offer it while the deal is open. Cancelling the deal releases it.",
  offer: "Nothing else can offer it while the deal is open. Cancelling the deal releases it.",
  agreed:
    "Locked to this deal from Agreed. To use another artwork, cancel this deal and open a new one.",
  cleared:
    "Locked to this deal from Agreed. To use another artwork, cancel this deal and open a new one.",
  invoiced:
    "Locked to this deal from Agreed. To use another artwork, cancel this deal and open a new one.",
  paid: "Paid. The register marks it sold when the deal settles.",
  released: "Paid. The register marks it sold when the deal settles.",
};

const settledAt = (deal: Pick<DealRecord, "timeline">): string | undefined =>
  deal.timeline.find((entry) => entry.toStage === "settled")?.createdAt;

/** The words for a linked artwork, from where the register says it is and how far the deal has got. */
export function linkedLine(
  deal: Pick<DealRecord, "reference" | "stage" | "timeline" | "cancelledAt">,
  artwork: NonNullable<DealRecord["artwork"]>,
): ArtworkSectionLine {
  const { chip, key } = artwork.whereItIs;
  if (deal.stage === "settled" && key === "sold") {
    const at = settledAt(deal);
    return {
      chip,
      lead: "Sold privately",
      trail: ` · ${deal.reference}${at ? `, ${formatStaffDateTime(at)}` : ""}`,
      note: "Sold is final. Nothing can offer it again.",
    };
  }
  if (deal.stage === "settled") {
    return {
      chip,
      lead: "Not marked sold yet",
      note: `The register still shows "${chip.label}". Until it is marked sold, nothing else changes here.`,
    };
  }
  if (deal.stage === "cancelled" && key === "withdrawn") {
    return {
      chip,
      lead: "Withdrawn",
      trail: ` from a private sale${deal.cancelledAt ? ` · ${formatStaffDateTime(deal.cancelledAt)}` : ""}`,
      note: "Released when the deal was cancelled. It can be offered again.",
    };
  }
  if (key === "private_sale") {
    return {
      chip,
      lead: "Held for this deal",
      trail: ` since ${formatStaffDateTime(artwork.heldSince)}`,
      note: HELD_NOTE[deal.stage] ?? "",
    };
  }
  // The register shows it somewhere else than this deal: say so plainly, never guess a reason.
  return {
    chip,
    lead: chip.label,
    note: "The register shows this artwork somewhere other than this deal.",
  };
}

/** The line the Artwork section shows: the linked artwork's place, or why there is none. */
export function artworkSectionLine(deal: DealRecord): ArtworkSectionLine {
  return deal.artwork ? linkedLine(deal, deal.artwork) : unlinkedLine(deal);
}

/** Which lines of the deal's artwork history to add to its timeline, as the history words them. */
export function artworkMoveTitle(move: DealRecord["artworkMoves"][number]): string {
  const name = (named: { title: string } | null) => named?.title ?? "the register";
  if (move.action === "linked") {
    return move.to ? "Artwork held for this deal" : "Artwork: recorded as not in the register";
  }
  if (move.action === "changed") {
    return `Artwork changed from ${name(move.from)} to ${name(move.to)}`;
  }
  return "Artwork removed";
}
