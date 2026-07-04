export { LotError } from "@auction/persistence/lib";

export class BidError extends Error {
  readonly code?: string | undefined;
  constructor(
    message: string,
    readonly status: number = 400,
    code?: string,
  ) {
    super(message);
    this.name = "BidError";
    this.code = code;
  }
}

import type { RoleCapability, UserRole, UserStaffRole } from "@auction/types";

export type AuthzErrorMeta = {
  code?: string;
  required?: RoleCapability[];
  actor?: { role: UserRole | string; staffRole: UserStaffRole | string | null };
};

export class AuthzError extends Error {
  readonly code?: string;
  readonly required?: RoleCapability[];
  readonly actor?: AuthzErrorMeta["actor"];

  constructor(
    message: string,
    readonly status: number = 403,
    meta?: AuthzErrorMeta,
  ) {
    super(message);
    this.name = "AuthzError";
    if (meta?.code !== undefined) this.code = meta.code;
    if (meta?.required !== undefined) this.required = meta.required;
    if (meta?.actor !== undefined) this.actor = meta.actor;
  }
}

/** Catalogue write paths: auction.manage OR catalogue.write (matches {@link canManageCatalogue}). */
export const CATALOGUE_WRITE_CAPABILITIES = [
  "auction.manage",
  "catalogue.write",
] as const satisfies readonly RoleCapability[];

export function missingCatalogueCapabilityError(
  message: string,
  role: UserRole | string,
  staffRole?: UserStaffRole | string | null,
): AuthzError {
  return new AuthzError(message, 403, {
    code: "missing_capability",
    required: [...CATALOGUE_WRITE_CAPABILITIES],
    actor: { role, staffRole: staffRole ?? null },
  });
}

export class ArtistError extends Error {
  readonly code?: string;
  readonly blockers?: string[];

  constructor(
    message: string,
    readonly status: number = 400,
    code?: string,
    blockers?: string[],
  ) {
    super(message);
    this.name = "ArtistError";
    if (code !== undefined) this.code = code;
    if (blockers !== undefined) this.blockers = blockers;
  }
}

export class CategoryError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "CategoryError";
  }
}

export class VenueError extends Error {
  readonly code?: string | undefined;

  constructor(
    message: string,
    readonly status: number = 400,
    code?: string,
  ) {
    super(message);
    this.name = "VenueError";
    if (code !== undefined) this.code = code;
  }
}

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "SubmissionError";
  }
}

/** Stripe or payment-gateway failure after retries, or non-retryable Stripe error. */
/** Thrown when a webhook-required capture did not transition payment status (claim must roll back). */
export class PaymentCaptureNotAppliedError extends Error {
  constructor(
    public readonly paymentId: string,
    public readonly status: string,
  ) {
    super(`payment_capture_not_applied:${paymentId}:${status}`);
    this.name = "PaymentCaptureNotAppliedError";
  }
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
    readonly stripeCode?: string,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
