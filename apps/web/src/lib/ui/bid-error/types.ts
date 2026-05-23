export type BidErrorSeverity = "error" | "info" | "warning";

export type BidErrorPresentation = {
  title?: string;
  message: string;
  severity: BidErrorSeverity;
  actionHref?: string;
  actionLabel?: string;
};

export type MapBidErrorOptions = {
  /** Safe same-origin path to return to after verify-identity (e.g. lot page). */
  verifyReturnPath?: string;
};

export interface BidErrorMatcher {
  match(raw: string, options?: MapBidErrorOptions): BidErrorPresentation | null;
}
