import type { GuestErasureOrder } from "@auction/shop-domain";

/** What the erasure rules need to know about a guest, read under a lock. */
export type GuestErasureSnapshot = {
  guestCustomerId: string;
  /** The normalised email, or the erased placeholder once erased. */
  email: string;
  erasedAt: Date | null;
  claimedAt: Date | null;
  /** The guest's own orders (not ones already moved to an account). */
  orders: GuestErasureOrder[];
};

/** What an erasure changed, for the audit entry and the staff confirmation. */
export type GuestErasureCounts = {
  orders: number;
  enquiries: number;
  links: number;
};

export type EraseGuestData = (input: {
  actorSubjectId: string;
  reason: string;
  now: Date;
}) => Promise<GuestErasureCounts>;

/**
 * Reads a guest and erases their personal data in one transaction, so the decision and the
 * erasure see the same state. Returns null when there is no such guest.
 */
export interface GuestErasureStore {
  read(guestCustomerId: string): Promise<GuestErasureSnapshot | null>;
  withLockedGuest<T>(
    guestCustomerId: string,
    work: (guest: GuestErasureSnapshot, erase: EraseGuestData) => Promise<T>,
  ): Promise<T | null>;
}
