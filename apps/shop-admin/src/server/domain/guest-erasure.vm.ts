import type { AdminGuestErasureState } from "@auction/shop-contracts";
import { GUEST_RECORD_RETENTION_YEARS } from "@auction/shop-domain";
import { formatStaffDate } from "@auction/staff-ui";

/** What staff read around erasing a guest's personal data. */
export const GUEST_ERASURE_COPY = {
  menuItem: "Erase guest data…",
  title: "Erase this guest's personal data?",
  description: `Their email, phone and marketing consent are removed, their order links stop working, the enquiries they sent are cleared and their CRM lead is deleted. The name and address on their invoices are kept for the ${GUEST_RECORD_RETENTION_YEARS}-year accounting record, seen only by finance and Administrators, then purged. This cannot be undone.`,
  confirm: "Erase guest data",
  done: "Guest data erased",
  unavailable: "Not available for this guest yet",
} as const;

/**
 * The quiet line the Customer panel keeps once a guest's data is erased. It names LAX, not the
 * staff member: who erased it is in the audit log.
 */
export function guestErasedLine(erasedAt: string): string {
  return `Guest data erased on ${formatStaffDate(erasedAt)} by LAX`;
}

/**
 * Why "Erase guest data…" has to wait, short enough for a line under a menu item: the full
 * sentence names every order, this one says "this order" when the block is the order on screen.
 */
export function guestErasureMenuReason(
  state: AdminGuestErasureState,
  currentReference: string | undefined,
): string | null {
  if (state.allowed || !state.blockedReason) return null;
  const refs = state.blockingOrderReferences;
  const which =
    refs.length === 1 && refs[0] === currentReference
      ? "this order"
      : refs.length === 1
        ? refs[0]
        : "other orders";
  switch (state.blockedReason) {
    case "already_erased":
      return "Already erased";
    case "claimed":
      return "This guest now has a LAX account";
    case "open_order":
      return `Available once ${which} is complete`;
    case "open_refund":
      return `Available once the refund on ${which} is done`;
    case "open_case":
      return `Available once the case on ${which} is closed`;
    case "cancellation_window":
      return state.availableFrom
        ? `Available after ${formatStaffDate(state.availableFrom)}`
        : "Available once the right to cancel ends";
  }
}

/**
 * Whether the order page offers erasure: only for a guest's own order, and only to people who
 * may erase.
 */
export function shouldLoadGuestErasure(input: {
  canErase: boolean;
  buyerIsGuest: boolean | undefined;
  guestCustomerId: string | null | undefined;
}): input is { canErase: true; buyerIsGuest: true; guestCustomerId: string } {
  return input.canErase && input.buyerIsGuest === true && Boolean(input.guestCustomerId);
}
