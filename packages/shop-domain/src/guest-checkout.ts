/**
 * Guest checkout rules. One LAX identity covers Bid, Shop and lax.art, so an email that already
 * belongs to a LAX account never checks out as a guest: the person signs in and keeps the basket.
 * A new email checks out as a guest, and the guest is also a Shop lead.
 */

/** The longest address RFC 5321 allows through a mail system. */
export const GUEST_EMAIL_MAX_LENGTH = 254;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed and lower-cased: the one form an email is compared and stored in. */
export function normaliseGuestEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A plausible address after normalising; delivery is what really proves it. */
export function isPlausibleGuestEmail(email: string): boolean {
  const normalised = normaliseGuestEmail(email);
  return normalised.length <= GUEST_EMAIL_MAX_LENGTH && EMAIL_SHAPE.test(normalised);
}

/** What the email step tells the shopper. */
export type GuestEmailDecision = "sign_in_required" | "continue_as_guest";

export function decideGuestEmail(input: { hasLaxAccount: boolean }): GuestEmailDecision {
  return input.hasLaxAccount ? "sign_in_required" : "continue_as_guest";
}

const GUEST_SUBJECT_PREFIX = "guest:";

/**
 * The owner recorded on a guest's orders until a LAX account claims them. Orders keep one owner
 * column, so a guest order is read and claimed through the same paths as an account's.
 */
export function guestOrderSubject(guestCustomerId: string): string {
  return `${GUEST_SUBJECT_PREFIX}${guestCustomerId}`;
}

/** The guest behind an owner value, or null when the owner is a LAX account. */
export function guestCustomerIdFromSubject(subject: string): string | null {
  if (!subject.startsWith(GUEST_SUBJECT_PREFIX)) return null;
  const id = subject.slice(GUEST_SUBJECT_PREFIX.length);
  return id.length > 0 ? id : null;
}

export function isGuestOrderSubject(subject: string): boolean {
  return guestCustomerIdFromSubject(subject) !== null;
}

/**
 * The marketing opt-in shown at guest checkout. The version is stored with every consent, so a
 * lead's consent can always be matched to the words the person agreed to. Change the version
 * whenever the wording changes.
 */
export const GUEST_MARKETING_CONSENT = {
  version: "shop-guest-news-2026-10-30",
  label: "Email me about new editions and artists",
  hint: "Optional. Your receipt and order updates come either way.",
} as const;

/** How long an emailed guest order link opens the order. */
export const GUEST_ORDER_LINK_TTL_DAYS = 30;

export function guestOrderLinkExpiry(now: Date): Date {
  return new Date(now.getTime() + GUEST_ORDER_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** What an opened guest order link resolves to. A claimed order now lives in the LAX account. */
export type GuestOrderLinkState = "valid" | "expired" | "claimed";

export function guestOrderLinkState(input: {
  expiresAt: Date;
  orderSubject: string;
  now: Date;
}): GuestOrderLinkState {
  if (!isGuestOrderSubject(input.orderSubject)) return "claimed";
  if (input.expiresAt.getTime() <= input.now.getTime()) return "expired";
  return "valid";
}
