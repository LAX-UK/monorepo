import type { SignedAgreementErrors } from "@auction/validators";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type SellerProceedsErrorCode =
  | "invalid_agreement"
  | "lot_not_found"
  | "no_seller"
  | "no_consignment"
  | "agreement_on_record"
  | "lot_changed"
  | "no_signed_document"
  | "already_settled_outside"
  | "sale_on_lax_payout"
  | "sale_awaiting_lax_payout"
  | "replace_needs_administrator"
  | "document_not_ready"
  | "not_sold_on_atg"
  | "reason_required";

/** A refusal staff can act on: a code for the screen, a sentence to show, and field errors. */
export class SellerProceedsError extends Error {
  constructor(
    readonly code: SellerProceedsErrorCode,
    readonly status: ContentfulStatusCode,
    message: string,
    readonly fields: SignedAgreementErrors = {},
  ) {
    super(message);
    this.name = "SellerProceedsError";
  }
}
