import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";

const BACK_TO_BIDS = {
  kind: "navigate",
  label: "Back to bids",
  href: "/bids#telephone-bids",
} as const;

/**
 * What the telephone booking page says when the booking is not shown. A missing booking and
 * someone else's read the same, and trying again cannot help either, so it offers the way back
 * only. A failed request can be tried again.
 */
export function telephoneBookingLoadFailure(
  failure: "not_found" | "unavailable",
  bookingId: string,
): DashboardSliceFailure {
  if (failure === "not_found") {
    return {
      slice: "telephoneBids",
      code: null,
      status: 404,
      title: "We can't find this telephone booking",
      message: "It may have been cancelled, or the link may be wrong. Your bookings are in Bids.",
      actions: [BACK_TO_BIDS],
    };
  }
  return {
    slice: "telephoneBids",
    code: null,
    status: 503,
    title: "This telephone booking couldn't be loaded",
    message: "Try again, or go back to your telephone bookings.",
    actions: [
      { kind: "retry", label: "Try again", href: `/bids/telephone/${bookingId}` },
      BACK_TO_BIDS,
    ],
  };
}
