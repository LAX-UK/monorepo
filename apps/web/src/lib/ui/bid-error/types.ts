export type BidErrorSeverity = "error" | "info" | "warning";

export type BidErrorActionKey = "switch-to-auto-bid" | "resend-verification-email";

export type BidErrorPresentation = {
  title?: string;
  message: string;
  severity: BidErrorSeverity;
  actionHref?: string;
  actionLabel?: string;
  /** In-page action resolved by the lot bid panel (not a navigation link). */
  actionKey?: BidErrorActionKey;
};

export type MapBidErrorOptions = {
  /** Safe same-origin path to return to after verify-identity (e.g. lot page). */
  verifyReturnPath?: string;
  lotId?: string;
  /** API error code when present (preferred over message matching). */
  code?: string | null;
  /** Link to sale page for registration CTAs. */
  saleRegistrationPath?: string;
  kycFeedback?: {
    headline?: string;
    detail?: string | null;
    needsResubmit?: boolean;
    action?: "start" | "continue" | "retry" | "wait" | "none";
  } | null;
};

export interface BidErrorMatcher {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null;
}
