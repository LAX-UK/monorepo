/** The failure code staff read as "Deleted in Zoho". */
export const PRODUCT_NOT_FOUND = "product_not_found";

/** What Zoho answers to a write on a Product that has been deleted there. */
export function deletedInZoho(code: string | undefined): boolean {
  return code === "RECORD_NOT_FOUND" || code === "ID_INVALID";
}
