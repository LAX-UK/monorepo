import {
  type FailedJobPayloadEntry,
  type StaffRoles,
  type UserRole,
  adminRoutes,
  canOpenAdminLink,
} from "@auction/types";

/** Payload fields that name a record with an admin page, by the label the payload shows. */
const RECORD_PAGES: Readonly<Record<string, (id: string) => string>> = {
  "Lot ID": adminRoutes.lot,
  "Sale ID": adminRoutes.sale.detail,
  "Submission ID": adminRoutes.submission,
  "Legal entity ID": adminRoutes.legalEntity,
  "User ID": adminRoutes.client,
  "Client ID": adminRoutes.client,
};

/** An identifier, not prose: a masked or partial value never links. */
const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * For each payload entry, the admin page of the record it names, or null when the field names
 * no record that has a page, the value is masked, or this person cannot open that page.
 */
export function payloadRecordHrefs(
  payload: readonly FailedJobPayloadEntry[],
  role: UserRole,
  staffRoles: StaffRoles | undefined,
): (string | null)[] {
  return payload.map((entry) => {
    const page = RECORD_PAGES[entry.label];
    if (!page || entry.masked || !RECORD_ID.test(entry.value)) return null;
    const href = page(entry.value);
    return canOpenAdminLink(role, staffRoles, href) ? href : null;
  });
}
