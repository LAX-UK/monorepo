export const RESERVATION_GRACE_MS = 60_000 as const;

export function reservedUntilFromCheckoutExpiry(checkoutSessionExpiresAt: Date): Date {
  return new Date(checkoutSessionExpiresAt.getTime() + RESERVATION_GRACE_MS);
}
