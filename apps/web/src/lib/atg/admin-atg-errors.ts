/** Plain-English messages for ATG admin API error codes. */
const ATG_ADMIN_ERROR_MESSAGES: Record<string, string> = {
  atg_disabled: "ATG sync is turned off in this environment.",
  atg_closed: "The ATG auction is closed and can no longer change.",
  not_linked: "Push this sale to ATG before using that action.",
  sale_cancelled: "Cancelled sales cannot be pushed to ATG.",
  sale_on_lax:
    "This sale is published on lax.bid. Unpublish it on the sale overview before pushing to ATG.",
  sale_not_found: "Sale not found.",
  lot_not_linked: "That lot is not linked to ATG.",
  queue_unavailable: "The ATG queue is unavailable. Try again in a moment.",
  atg_action_failed: "The ATG action could not be completed.",
  invalid_response: "Unexpected response from the server.",
};

export function humanizeAtgAdminError(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return ATG_ADMIN_ERROR_MESSAGES[code] ?? fallback;
}
