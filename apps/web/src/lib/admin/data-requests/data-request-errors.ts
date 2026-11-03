import type { DataRequestError } from "@auction/identity-contracts/data-requests";

/** What a refusal from Identity says to the person, one sentence each. */
export const DATA_REQUEST_ERROR_COPY: Readonly<Record<DataRequestError, string>> = {
  not_found: "That request no longer exists.",
  stale_version: "This request changed while you were editing it.",
  own_request: "Another person must handle a request about you.",
  not_open: "This request is no longer open.",
  already_closed: "This request is already closed.",
  not_manual: "Only a request logged by staff can be changed here.",
  extension_not_allowed: "This request can't be extended.",
  already_extended: "This request has already been extended once.",
  extension_after_due_date: "Extensions must be recorded before the original due date.",
  person_told_after_due_date: "The person must be told on or before the original due date.",
  told_in_future: "The date the person was told can't be in the future.",
  waiting_for_id: "The clock hasn't started: record when the proof of identity arrived first.",
  not_waiting_for_id: "This request isn't waiting for proof of identity.",
  continue_not_allowed: "Only a delayed or failed download can be continued manually.",
  already_continued: "This download has already been continued manually.",
  received_in_future: "The date can't be in the future.",
  date_before_received: "The date can't be before the request was received.",
  account_not_found: "That LAX account no longer exists.",
  product_not_in_scope: "That product isn't part of this request.",
  product_already_gathered: "A product that is already gathered can't be removed from the request.",
  contact_not_editable: "This person's contact details can't be edited.",
  exemption_required: "Name the exemption that applies.",
  refusal_reason_required: "Say why the request is manifestly unfounded or excessive.",
  complaint_right_required: "The person must be told they may complain to the ICO.",
  ambiguous_reference: "More than one download has this reference. Open it from the list.",
};

const UNAVAILABLE = "Identity didn't answer. Nothing was changed. Try again in a moment.";

export function isDataRequestError(code: string | undefined): code is DataRequestError {
  return code !== undefined && code in DATA_REQUEST_ERROR_COPY;
}

/** The sentence for a failed write: Identity's own refusal, or a plain "didn't answer". */
export function dataRequestErrorMessage(
  code: string | undefined,
  status: number | undefined,
): string {
  if (isDataRequestError(code)) return DATA_REQUEST_ERROR_COPY[code];
  if (status === 403) return "You don't have permission to change data requests.";
  return UNAVAILABLE;
}

/** The record changed under the editor; the page offers a reload and keeps what was typed. */
export function isStaleDataRequest(code: string | undefined): boolean {
  return code === "stale_version";
}
