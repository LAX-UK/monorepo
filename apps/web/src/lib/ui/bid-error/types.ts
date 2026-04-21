export type BidErrorSeverity = "error" | "info" | "warning";

export type BidErrorPresentation = {
  title?: string;
  message: string;
  severity: BidErrorSeverity;
};

export interface BidErrorMatcher {
  match(raw: string): BidErrorPresentation | null;
}
