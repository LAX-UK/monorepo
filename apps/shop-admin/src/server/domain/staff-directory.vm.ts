import type { AdminStaffMemberList } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import type { EnumOption, StatusPresentation } from "@auction/staff-ui";
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

const ROLE_DESCRIPTIONS: Record<(typeof GRANTABLE_STAFF_ROLES)[number], string> = {
  operations: "Orders, production, fulfilment and enquiries",
  catalogue_editor: "Artworks, artists and editorial pages",
  account_manager: "Their clients, sales and sale limits",
  broker: "Third-party sales and stock holds",
  finance: "Orders, refunds, payouts and the audit log",
  shop_admin: "Everything, including staff and settings",
};

export const STAFF_ROLE_OPTIONS: EnumOption<(typeof GRANTABLE_STAFF_ROLES)[number]>[] =
  GRANTABLE_STAFF_ROLES.map((role) => ({
    value: role,
    label: staffRoleLabel(role),
    description: ROLE_DESCRIPTIONS[role],
  }));

export function isGrantableRole(role: string): role is (typeof GRANTABLE_STAFF_ROLES)[number] {
  return (GRANTABLE_STAFF_ROLES as readonly string[]).includes(role);
}

/** The name staff recognise: the profile name, else the email, else a short account reference. */
export function staffMemberName(
  row: Pick<StaffMemberRow, "displayName" | "email" | "identitySubjectId">,
) {
  return row.displayName ?? row.email ?? `Account ${row.identitySubjectId.slice(0, 8)}`;
}

export function staffMemberStatus(row: Pick<StaffMemberRow, "disabledAt">): StatusPresentation {
  return row.disabledAt
    ? { label: "Disabled", tone: "neutral" }
    : { label: "Active", tone: "success" };
}

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/** "Today", "Yesterday", "3 days ago", "2 months ago"; "No activity yet" when never seen. */
export function lastActiveLabel(iso: string | null, now: Date): string {
  if (!iso) return "No activity yet";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "No activity yet";
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days < 30) return capitalise(RELATIVE.format(-days, "day"));
  if (days < 365) return capitalise(RELATIVE.format(-Math.floor(days / 30), "month"));
  return capitalise(RELATIVE.format(-Math.floor(days / 365), "year"));
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Search by name or email, and narrow by role; both optional. */
export function filterStaff(
  rows: readonly StaffMemberRow[],
  filter: { q: string; roles: readonly string[] },
): StaffMemberRow[] {
  const q = filter.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter.roles.length > 0 && !filter.roles.includes(row.role)) return false;
    if (!q) return true;
    return [row.displayName, row.email].some((value) => value?.toLowerCase().includes(q));
  });
}
