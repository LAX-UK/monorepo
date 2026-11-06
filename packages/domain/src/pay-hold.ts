import type { LegalEntityStatus, UserKycStatus } from "@auction/types";
import { organisationStateAllows } from "./organisation-state-policy.js";

/**
 * When a hold that keeps a buyer from paying began, kept so that releasing it moves only the
 * invoices that fell due during the hold, never debt that was already overdue before it.
 *
 * `null` means no hold is recorded. Released, that reads as "held since the beginning"
 * ({@link holdStartAt}), which moves every unpaid invoice: the safe side for a buyer who could
 * never pay, since nothing they owed was overdue while they could.
 */
export type HeldSince = Date | null;

/** The start of a hold for a release: the recorded moment, or the beginning of time. */
export function holdStartAt(heldSince: HeldSince | undefined): Date {
  return heldSince ?? new Date(0);
}

/**
 * An organisation's `pay_held_since` after it moves from `from` to `to`. It starts when the
 * organisation goes from a status that allows paying to one that does not, is kept through steps
 * between statuses that do not allow it (documents asked for, received, under review), and clears
 * when paying opens again.
 */
export function payHeldSinceAfter(input: {
  from: LegalEntityStatus;
  to: LegalEntityStatus;
  heldSince: HeldSince;
  at: Date;
}): HeldSince {
  if (organisationStateAllows(input.to, "pay")) return null;
  if (organisationStateAllows(input.from, "pay")) return input.at;
  return input.heldSince;
}

/**
 * A person's `identity_held_since` after their identity status moves from `from` to `to`. It
 * starts when an approved identity stops being approved, is kept while it is not approved, and
 * clears on approval. A person who was never approved has none: held from the start.
 */
export function identityHeldSinceAfter(input: {
  from: UserKycStatus;
  to: UserKycStatus;
  heldSince: HeldSince;
  at: Date;
}): HeldSince {
  if (input.to === "approved") return null;
  if (input.from === "approved") return input.at;
  return input.heldSince;
}
