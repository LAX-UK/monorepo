import type { AdminGeneralEnquiryRow } from "@auction/shop-contracts";

/**
 * Who staff should reply to. Guests have no account, so the typed name and email are the
 * only identity; signed-in senders show the account id, plus whatever contact details they sent.
 */
export function generalEnquirySenderLabel(
  row: Pick<AdminGeneralEnquiryRow, "identitySubjectId" | "contactName" | "contactEmail">,
): string {
  const contact = [row.contactName, row.contactEmail].filter(Boolean).join(" · ");
  if (row.identitySubjectId === null) return contact || "Guest";
  const account = `Subject ${row.identitySubjectId}`;
  return contact ? `${contact} · ${account}` : account;
}
