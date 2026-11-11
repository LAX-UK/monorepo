import type { PrivateSaleArtworkUnlinkedReason } from "@auction/types";
import type { AdminDealConvertInput, DealArtworkOption } from "@auction/validators";

/** What staff decided about a deal's artwork: an original from the register, or why there is none. */
export type ArtworkChoice =
  | { mode: "register"; artwork: DealArtworkOption | null }
  | { mode: "not_in_register"; reason: PrivateSaleArtworkUnlinkedReason | null };

export const ARTWORK_REQUIRED = "Choose the artwork from the register, or say why it isn't there.";
export const REASON_REQUIRED = "Say why it isn't in the register.";
export const ARTWORK_REFUSED = "Choose an artwork that can be held.";

/** Each reason says what it means for the deal. Listed in the order staff read them. */
export const UNLINKED_REASONS: ReadonlyArray<{
  reason: PrivateSaleArtworkUnlinkedReason;
  label: string;
  hint: string;
}> = [
  {
    reason: "sellers_own_work",
    label: "The seller's own work",
    hint: "The gallery doesn't hold it, so it isn't in Zoho. The deal can go ahead without the register.",
  },
  {
    reason: "in_zoho_not_linked",
    label: "In Zoho, but not linked yet",
    hint: "Link it from the deal page. The deal can't be agreed until it is.",
  },
];

/**
 * A buy enquiry starts on the register, where the buyer's piece is held for the deal. A sell
 * enquiry starts on the seller's own work, because a client's own work is not gallery stock.
 */
export function defaultArtworkChoice(buying: boolean): ArtworkChoice {
  return buying
    ? { mode: "register", artwork: null }
    : { mode: "not_in_register", reason: "sellers_own_work" };
}

/** What is still missing from the choice, in the words shown beside it; nothing when it is complete. */
export function artworkChoiceError(choice: ArtworkChoice): string | undefined {
  if (choice.mode === "register") return choice.artwork ? undefined : ARTWORK_REQUIRED;
  return choice.reason ? undefined : REASON_REQUIRED;
}

/** The choice as the convert request carries it: the register artwork or the reason, never both. */
export function artworkConvertInput(
  choice: ArtworkChoice,
): Pick<AdminDealConvertInput, "artworkRegisterId" | "notInRegister"> {
  if (choice.mode === "register") {
    return choice.artwork ? { artworkRegisterId: choice.artwork.id } : {};
  }
  return choice.reason ? { notInRegister: { reason: choice.reason } } : {};
}
