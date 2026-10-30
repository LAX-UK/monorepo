import { GUEST_RECORD_RETENTION_YEARS } from "@auction/shop-domain";
import { formatStaffDate } from "@auction/staff-ui";

/** What staff read around erasing a guest's personal data. */
export const GUEST_ERASURE_COPY = {
  button: "Erase guest data",
  title: "Erase this guest's personal data?",
  description: `Their name, email, phone and delivery address are removed from their orders, enquiries and leads, their order links stop working and their CRM lead is deleted. The orders and invoices stay, without those details, for the ${GUEST_RECORD_RETENTION_YEARS}-year accounting record. This cannot be undone.`,
  confirm: "Erase guest data",
  done: "Guest data erased",
} as const;

/** The line shown in place of the guest's details once they have been erased. */
export function guestErasedNotice(erasedAt: string): { title: string; body: string } {
  return {
    title: `Personal data erased on ${formatStaffDate(erasedAt)}`,
    body: "The order and its invoice are kept for the accounting record, without the guest's name, email, phone or address.",
  };
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
