import type { AdminClientDetail } from "@auction/shop-contracts";
import { formatStaffMoney } from "@auction/staff-ui";

/*
 * A client's record page in LAX Admin: their Shop and lax.art activity only. Their bidding lives
 * in Bid admin, so the page links there (by the email on their LAX login) rather than copying it.
 */

export function clientPageHref(partyId: string): string {
  return `/clients/${encodeURIComponent(partyId)}`;
}

/** Bid admin's client list searched by their email; none without an email or a Bid address. */
export function bidClientHref(
  bidPublicUrl: string | undefined,
  email: string | null,
): string | null {
  if (!bidPublicUrl || !email) return null;
  return `${bidPublicUrl}/admin/clients?q=${encodeURIComponent(email)}`;
}

/** Their orders in the orders list, found by their email; none without one. */
export function clientOrdersHref(email: string | null | undefined): string | null {
  return email ? `/orders?q=${encodeURIComponent(email)}` : null;
}

const TOPIC_LABELS: Record<string, string> = {
  general: "General enquiry",
  private_viewing: "Private viewing",
  art_advisory: "Art advisory",
  selling: "Selling",
  exhibition: "Exhibition",
  order_problem: "Order problem",
};

type Enquiry = NonNullable<AdminClientDetail["enquiries"]>[number];

/** What an enquiry was about: the artwork's title, or the general enquiry's topic in words. */
export function enquirySubject(enquiry: Enquiry): string {
  return enquiry.kind === "artwork"
    ? enquiry.subject
    : (TOPIC_LABELS[enquiry.subject] ?? "General enquiry");
}

export function enquiryHref(enquiry: Enquiry): string {
  return `/enquiries/${enquiry.kind}/${encodeURIComponent(enquiry.enquiryId)}`;
}

export type ClientFigure = { id: string; label: string; value: string; hint?: string };

/**
 * The four numbers at the top of a client's page, each said once: what they have paid to date,
 * their orders, the editions they own, and what LAX owes them now.
 */
export function clientFigures(detail: AdminClientDetail): ClientFigure[] {
  const due = detail.payouts
    .filter((payout) => payout.status === "due")
    .reduce((sum, payout) => sum + payout.netPence, 0);
  const orders = detail.orderCount ?? detail.orders?.length;
  return [
    {
      id: "paid",
      label: "Paid to date",
      value: detail.paidToDatePence === undefined ? "—" : formatStaffMoney(detail.paidToDatePence),
      hint: "Captured Shop payments, less refunds",
    },
    { id: "orders", label: "Orders", value: orders === undefined ? "—" : String(orders) },
    { id: "editions", label: "Editions owned", value: String(detail.editions.length) },
    {
      id: "due",
      label: "Payouts due",
      value: due > 0 ? formatStaffMoney(due) : "None",
      ...(due > 0 ? { hint: "Owed to them now" } : {}),
    },
  ];
}
