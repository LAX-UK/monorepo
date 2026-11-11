/** What a refusal from the Bid API says to the person, one sentence each. */
export const DEAL_ERROR_COPY: Readonly<Record<string, string>> = {
  deal_not_found: "This private sale no longer exists, or you can't open it.",
  stale_version: "This private sale changed while you were looking at it.",
  forbidden: "You can't make this change.",
  term_locked: "That can't be changed at this stage.",
  vat_treatment_not_allowed: "That VAT treatment is not on the approved list.",
  buyer_invalid: "That person can't be the buyer. They need a client account.",
  buyer_locked: "The buyer can't be changed once the price is agreed.",
  buyer_is_seller: "The buyer can't be the seller.",
  blocked: "This can't be done yet.",
  payment_in_progress: "A bank transfer is on its way. Wait for it to arrive, then refund it.",
  unavailable: "The Bid API didn't answer. Nothing was changed.",
  // Converting an enquiry
  enquiry_not_found: "This enquiry no longer exists, or you can't open it.",
  not_a_private_sale_enquiry: "Only private sale enquiries can become a deal.",
  not_ready: "Mark the enquiry in progress before turning it into a deal.",
  already_converted: "This enquiry is already a deal.",
  account_required:
    "The sender has no LAX account yet. Invite them to create one, then convert the enquiry.",
  work_required: "Enter the reference of the work this buyer is asking about, such as C-1042.",
  work_not_found: "No work has that reference.",
  work_not_available: "Only an approved consignment that isn't on a lot yet can be sold privately.",
  work_in_deal: "That work is already in a private sale.",
  artwork_not_found: "The artwork register has no artwork with that id.",
  artwork_not_original: "Only an original artwork can be sold privately.",
  artwork_unavailable: "This artwork is already offered somewhere else, reserved or sold.",
  artwork_register_busy: "The artwork's record is busy. Try again.",
  work_has_no_seller_contact: "That work has no one who can act for its owner yet.",
};

const UNAVAILABLE = "The Bid API didn't answer. Nothing was changed. Try again in a moment.";

/** The sentence for a failed write: the API's own refusal, or a plain "didn't answer". */
export function dealErrorMessage(
  code: string | undefined,
  status: number | undefined,
  /** The API's own sentence, preferred for a refusal that says where the artwork is. */
  apiMessage?: string,
): string {
  if (code === "artwork_unavailable" && apiMessage) return apiMessage;
  if (code && code in DEAL_ERROR_COPY) return DEAL_ERROR_COPY[code] as string;
  if (status === 403) return "You don't have permission to change private sales.";
  return UNAVAILABLE;
}

/** The deal changed under the editor; the page offers a reload and keeps what was typed. */
export function isStaleDeal(code: string | undefined): boolean {
  return code === "stale_version";
}
