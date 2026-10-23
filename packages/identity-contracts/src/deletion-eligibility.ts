import { z } from "zod";

/**
 * Deleting a LAX account is decided by Identity, but only each product knows whether the
 * person still owes or is owed something there. Identity therefore asks every product the same
 * question and refuses unless all of them answer "nothing is in the way".
 */

/** Products that own data a person can have in flight, and so are asked before a deletion. */
export const DELETION_ELIGIBILITY_PRODUCTS = ["bid", "shop"] as const;

export type DeletionEligibilityProduct = (typeof DELETION_ELIGIBILITY_PRODUCTS)[number];

/** Where every product mounts its machine-authenticated routes for Identity. */
export const INTERNAL_IDENTITY_ROUTE_PREFIX = "/internal/identity";

/** The route every product serves under that prefix, with `:subjectId` as the parameter. */
export const DELETION_ELIGIBILITY_SUBROUTE = "/subjects/:subjectId/deletion-eligibility";

/** The full path Identity calls on a product for one person. */
export function deletionEligibilityPath(subjectId: string): string {
  return `${INTERNAL_IDENTITY_ROUTE_PREFIX}${DELETION_ELIGIBILITY_SUBROUTE.replace(
    ":subjectId",
    encodeURIComponent(subjectId),
  )}`;
}

export const deletionBlockerSchema = z.object({
  /** Stable, machine-readable reason, owned by the product. */
  code: z.string().min(1).max(100),
  /** One plain-language sentence the person can act on, in British English. */
  message: z.string().min(1).max(300),
  /** Where in the product the person resolves it; null when the product has no such page. */
  href: z.string().url().nullable(),
});

/** What one product answers: the reasons this person cannot delete their account yet. */
export const productDeletionEligibilitySchema = z.object({
  product: z.enum(DELETION_ELIGIBILITY_PRODUCTS),
  blockers: z.array(deletionBlockerSchema).max(50),
});

/**
 * One product's part of Identity's combined answer. `unavailable` means the product did not
 * answer in time or answered badly: that blocks deletion, because silence is not consent.
 */
export const accountDeletionProductSchema = z.object({
  product: z.enum(DELETION_ELIGIBILITY_PRODUCTS),
  state: z.enum(["clear", "blocked", "unavailable"]),
  blockers: z.array(deletionBlockerSchema),
});

/** Issuer routes LAX Account calls (under the Better Auth base path) to delete an account. */
export const ACCOUNT_DELETION_PATH = "/lax/account-deletion";
export const ACCOUNT_DELETION_REQUEST_PATH = "/lax/account-deletion/request";
export const ACCOUNT_DELETION_CANCEL_PATH = "/lax/account-deletion/cancel";

/** What the person types to confirm. Kept identical to LAX Bid's, which asks for the same phrase. */
export const ACCOUNT_DELETION_CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

/** Days between asking for deletion and the personal data being erased; cancelling is possible until then. */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

export const accountDeletionStatusSchema = z.object({
  /** When deletion was asked for; null when it has not been. */
  requestedAt: z.string().datetime({ offset: true }).nullable(),
  products: z.array(accountDeletionProductSchema),
});

/**
 * The answer to "delete my account". All three are business outcomes, not failures, so they
 * travel with HTTP 200 and the caller (LAX Account, or LAX Bid through the internal route)
 * decides what to tell the person.
 */
export const accountDeletionOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("requested"), requestedAt: z.string().datetime({ offset: true }) }),
  z.object({
    outcome: z.literal("already_requested"),
    requestedAt: z.string().datetime({ offset: true }),
  }),
  /** Something is in the way, or a product could not be asked. Nothing was changed. */
  z.object({ outcome: z.literal("not_eligible"), status: accountDeletionStatusSchema }),
]);

export const accountDeletionCancelOutcomeSchema = z.object({
  outcome: z.enum(["cancelled", "not_requested"]),
});

export type DeletionBlocker = z.infer<typeof deletionBlockerSchema>;
export type ProductDeletionEligibility = z.infer<typeof productDeletionEligibilitySchema>;
export type AccountDeletionProduct = z.infer<typeof accountDeletionProductSchema>;
export type AccountDeletionStatus = z.infer<typeof accountDeletionStatusSchema>;
export type AccountDeletionOutcome = z.infer<typeof accountDeletionOutcomeSchema>;

/**
 * What the combined answer means for the person:
 *  - `requested`: deletion is already under way (cancel is the only action);
 *  - `blocked`: at least one product named something to resolve first;
 *  - `unavailable`: nothing is named, but a product could not be asked, so try again later;
 *  - `eligible`: every product answered and none has anything in the way.
 */
export type AccountDeletionVerdict = "requested" | "blocked" | "unavailable" | "eligible";

export function accountDeletionVerdict(status: AccountDeletionStatus): AccountDeletionVerdict {
  if (status.requestedAt) return "requested";
  if (status.products.some((product) => product.state === "blocked")) return "blocked";
  if (status.products.some((product) => product.state === "unavailable")) return "unavailable";
  return "eligible";
}
