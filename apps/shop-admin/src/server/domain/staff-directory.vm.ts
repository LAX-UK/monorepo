import type { AdminStaffMemberList } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import type { EnumOption } from "@auction/staff-ui";
import { staffRoleLabel } from "./staff-role-label.vm";

export type StaffMemberRow = AdminStaffMemberList["items"][number];

/** Every role LAX Admin can grant, in the order staff usually pick them. */
export const GRANTABLE_STAFF_ROLES = [
  "operations",
  "catalogue_editor",
  "account_manager",
  "broker",
  "finance",
  "shop_admin",
] as const satisfies readonly ShopStaffRole[];

export type GrantableStaffRole = (typeof GRANTABLE_STAFF_ROLES)[number];

/** What each role lets someone see and do in LAX Admin, in plain words. */
const ROLE_ALLOWS: Record<GrantableStaffRole, string> = {
  operations: "Orders, production, fulfilment and enquiries.",
  catalogue_editor: "Artworks, artists, merchandise and the editorial pages.",
  account_manager: "Their own clients, with those clients' sales and sale limits.",
  broker: "Third-party sales and stock holds for the clients assigned to them.",
  finance: "Orders, refunds, payouts, edition prices and the audit log.",
  shop_admin: "Everything, including staff, settings and the audit log.",
};

export const STAFF_ROLE_OPTIONS: EnumOption<GrantableStaffRole>[] = GRANTABLE_STAFF_ROLES.map(
  (role) => ({ value: role, label: staffRoleLabel(role), description: ROLE_ALLOWS[role] }),
);

export function isGrantableRole(role: string): role is GrantableStaffRole {
  return (GRANTABLE_STAFF_ROLES as readonly string[]).includes(role);
}

/** What a role allows, for the grant confirm and the record panel. */
export function staffRoleAllows(role: string): string | null {
  return isGrantableRole(role) ? ROLE_ALLOWS[role] : null;
}

/** The name staff recognise: the profile name, else the email. */
export function staffMemberName(row: Pick<StaffMemberRow, "displayName" | "email">): string {
  return row.displayName ?? row.email ?? "Name not set yet";
}

/** A rough email check before asking the API, which has the final word. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
