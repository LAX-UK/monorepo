/** What a refusal from the Bid API says to the person, one sentence each. */
export const ENQUIRY_ERROR_COPY: Readonly<Record<string, string>> = {
  enquiry_not_found: "This enquiry no longer exists, or you can't open it.",
  stale_version: "This enquiry changed while you were editing it.",
  assign_forbidden: "You can't hand enquiries over.",
  assignee_invalid: "That person can't be given enquiries.",
  unchanged: "Nothing was changed.",
  not_allowed: "That change isn't available from this status.",
  close_reason_required: "Choose why you're closing this enquiry.",
  close_reason_not_applicable: "A reason applies only when closing.",
  close_reason_without_status: "A reason applies only when closing.",
  conversion_unavailable: "Only private sale enquiries can become a deal.",
  conversion_not_manual: "An enquiry becomes converted when it is turned into a deal.",
};

const UNAVAILABLE = "The Bid API didn't answer. Nothing was changed. Try again in a moment.";

/** The sentence for a failed write: the API's own refusal, or a plain "didn't answer". */
export function enquiryErrorMessage(code: string | undefined, status: number | undefined): string {
  if (code && code in ENQUIRY_ERROR_COPY) return ENQUIRY_ERROR_COPY[code] as string;
  if (status === 403) return "You don't have permission to change enquiries.";
  return UNAVAILABLE;
}

/** The enquiry changed under the editor; the page offers a reload and keeps what was typed. */
export function isStaleEnquiry(code: string | undefined): boolean {
  return code === "stale_version";
}
