import { sellerMoney } from "@/lib/seller/consignment-agreement-view";
import { formatDate } from "@/lib/ui/format";
import type { SellerUnsoldLotView, UnsoldLotChoice, UnsoldLotChoiceKind } from "@auction/types";

/** The three outcomes a seller can ask for, as they read them. */
export const UNSOLD_CHOICE_OPTIONS: Record<
  UnsoldLotChoiceKind,
  { label: string; description: string }
> = {
  relist: {
    label: "Relist it",
    description: "Offer it again in a future sale. You can ask for a lower reserve.",
  },
  private_sale: {
    label: "Sell it privately",
    description: "Your specialist offers it to buyers directly, outside an auction.",
  },
  collect: {
    label: "Have it returned",
    description: "We arrange for you to collect it, or send it back to you.",
  },
};

export const UNSOLD_CHOICE_ORDER: readonly UnsoldLotChoiceKind[] = [
  "relist",
  "private_sale",
  "collect",
];

/** "Relist with a reserve of £4,000", "Sell it privately", … */
export function unsoldChoiceSummary(
  kind: UnsoldLotChoiceKind,
  reserve: string | null,
  currency: string,
): string {
  if (kind !== "relist") return UNSOLD_CHOICE_OPTIONS[kind].label;
  return reserve
    ? `Relist it with a reserve of ${sellerMoney(reserve, currency)}`
    : "Relist it with the current reserve";
}

export type UnsoldChoiceHistoryEntry = { label: string; by: string; on: string };

export type UnsoldChoiceViewModel =
  /** Nothing chosen yet and the person may choose. */
  | { mode: "choose"; reserveHint: string }
  /** Nothing chosen yet; someone else in the organisation chooses. */
  | { mode: "waiting_on_admin"; message: string }
  /** The choice waits for a specialist. */
  | {
      mode: "requested";
      summary: string;
      canChange: boolean;
      reserveHint: string;
      history: UnsoldChoiceHistoryEntry[];
    }
  /** A specialist confirmed what happens next. */
  | {
      mode: "confirmed";
      summary: string;
      adjusted: boolean;
      note: string | null;
      history: UnsoldChoiceHistoryEntry[];
    };

function reserveHint(view: SellerUnsoldLotView): string {
  const parts = [
    view.currentReserve
      ? `Leave it empty to keep the current reserve of ${sellerMoney(view.currentReserve, view.currency)}.`
      : "Leave it empty to relist without a reserve.",
  ];
  if (view.reserveFloor) {
    parts.push(
      `Your specialist accepts no lower than ${sellerMoney(view.reserveFloor, view.currency)}.`,
    );
  }
  return parts.join(" ");
}

function history(choice: UnsoldLotChoice): UnsoldChoiceHistoryEntry[] {
  const entries: UnsoldChoiceHistoryEntry[] = [];
  if (choice.requestedChoice && choice.requestedAt) {
    entries.push({
      label: `Asked: ${unsoldChoiceSummary(choice.requestedChoice, choice.requestedReserve, choice.currency)}`,
      by: choice.requestedByName ?? "Your account",
      on: formatDate(choice.requestedAt),
    });
  }
  if (choice.decidedChoice && choice.decidedAt) {
    entries.push({
      label: `Confirmed: ${unsoldChoiceSummary(choice.decidedChoice, choice.decidedReserve, choice.currency)}`,
      by: "Your specialist",
      on: formatDate(choice.decidedAt),
    });
  }
  return entries;
}

/** What the seller sees about a lot that did not sell, from what was chosen and who they are. */
export function unsoldChoiceViewModel(
  view: SellerUnsoldLotView,
  account: { organisationName: string | null },
): UnsoldChoiceViewModel {
  const { choice } = view;
  if (choice?.status === "confirmed" && choice.decidedChoice) {
    return {
      mode: "confirmed",
      summary: unsoldChoiceSummary(choice.decidedChoice, choice.decidedReserve, choice.currency),
      adjusted: Boolean(choice.staffNote),
      note: choice.staffNote,
      history: history(choice),
    };
  }
  if (choice?.requestedChoice) {
    return {
      mode: "requested",
      summary: unsoldChoiceSummary(
        choice.requestedChoice,
        choice.requestedReserve,
        choice.currency,
      ),
      canChange: view.canChoose,
      reserveHint: reserveHint(view),
      history: history(choice),
    };
  }
  if (view.canChoose) return { mode: "choose", reserveHint: reserveHint(view) };
  return {
    mode: "waiting_on_admin",
    message: `An owner or admin of ${account.organisationName ?? "the organisation"} chooses what happens next. You'll see their choice here.`,
  };
}
