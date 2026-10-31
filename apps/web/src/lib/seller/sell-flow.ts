import type { SellerAccountOption } from "./seller-account-options";

/** The last button of Sell a work names the organisation the work is sent for. */
export function sendToSpecialistsLabel(option: Pick<SellerAccountOption, "kind" | "name"> | null) {
  return option?.kind === "organisation"
    ? `Send to our specialists for ${option.name}`
    : "Send to our specialists";
}
