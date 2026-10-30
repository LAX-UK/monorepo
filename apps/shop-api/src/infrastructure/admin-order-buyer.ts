import { isGuestOrderSubject } from "@auction/shop-domain";

type BuyerColumns = {
  buyerName: string | null;
  buyerEmail: string | null;
  guestName: string | null;
  guestEmail: string | null;
};

/**
 * Who bought an order, for staff: the LAX account's profile, or the details a guest gave at
 * checkout while the order is still a guest's.
 */
export function orderBuyer(
  subject: string,
  columns: BuyerColumns,
): { buyerName: string | null; buyerEmail: string | null; buyerIsGuest: boolean } {
  const buyerIsGuest = isGuestOrderSubject(subject);
  const name = buyerIsGuest ? columns.guestName : columns.buyerName;
  const email = buyerIsGuest ? columns.guestEmail : columns.buyerEmail;
  return { buyerName: name?.trim() || null, buyerEmail: email?.trim() || null, buyerIsGuest };
}
