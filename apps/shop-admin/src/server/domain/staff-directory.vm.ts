import type { AdminStaffMemberList } from "@auction/shop-contracts";
import { SHOP_STAFF_ROLES, type ShopStaffRole } from "@auction/shop-domain";
import { formatStaffDate } from "@auction/staff-ui";
import { staffRoleLabel } from "./staff-role-label.vm";

export type StaffMemberRow = AdminStaffMemberList["items"][number];

/** Every LAX Admin role, in the order the role filter lists them. */
export const STAFF_ROLES = SHOP_STAFF_ROLES;

export type StaffRoleValue = ShopStaffRole;

/** What each role lets someone see and do in LAX Admin, in plain words. */
const ROLE_ALLOWS: Record<ShopStaffRole, string> = {
  shop_admin: "Everything, including settings, edition corrections and the audit log.",
  account_manager: "Their own clients, with those clients' sales and sale limits.",
  broker: "Stock holds for the clients assigned to them.",
  operations: "Orders, production, fulfilment, third-party sales and enquiries.",
  finance: "Orders, refunds, payouts, edition prices and the audit log.",
  catalogue_editor: "Artworks, edition runs, artists and artist applications.",
  editor: "Stories, exhibitions, pages and help, written and published.",
  read_only: "Orders, enquiries and merchandise, without client records, buying prices or actions.",
};

export const STAFF_ROLE_OPTIONS: { value: ShopStaffRole; label: string; description: string }[] =
  STAFF_ROLES.map((role) => ({
    value: role,
    label: staffRoleLabel(role),
    description: ROLE_ALLOWS[role],
  }));

function isStaffRole(role: string): role is ShopStaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** What one role allows, or null for a role this release does not know. */
export function staffRoleAllows(role: string): string | null {
  return isStaffRole(role) ? ROLE_ALLOWS[role] : null;
}

/** What a person's roles allow together, one sentence per role, in role order. */
export function staffRolesAllow(roles: readonly string[]): string | null {
  const known = STAFF_ROLES.filter((role) => roles.includes(role));
  if (known.length === 0) return null;
  if (known.length === 1) return ROLE_ALLOWS[known[0] as ShopStaffRole];
  return known.map((role) => `${staffRoleLabel(role)}: ${ROLE_ALLOWS[role]}`).join(" ");
}

/** One held role as a read-only chip shows it: its name and its period. */
export type StaffRoleChip = { key: string; label: string; meta: string };

/** A role chosen to run "until 30 Nov" ends as 1 Dec starts, so the last day is the day before. */
function lastDay(endsAt: string): string {
  return formatStaffDate(new Date(new Date(endsAt).getTime() - 1));
}

export function staffRoleChips(row: Pick<StaffMemberRow, "roles">, now: Date): StaffRoleChip[] {
  return row.roles.map((held) => {
    const started = new Date(held.startsAt).getTime() <= now.getTime();
    const from = `${started ? "Since" : "Starts"} ${formatStaffDate(held.startsAt)}`;
    return {
      key: `${held.role}-${held.startsAt}`,
      label: staffRoleLabel(held.role),
      meta: held.endsAt ? `${from} · Until ${lastDay(held.endsAt)}` : from,
    };
  });
}

/** The roles shown for a person: every role held, else the one on their record. */
export function staffRoleNames(row: Pick<StaffMemberRow, "roles" | "role">): string[] {
  return row.roles.length > 0 ? row.roles.map((held) => held.role) : [row.role];
}

/** The name staff recognise: the profile name, else the email. */
export function staffMemberName(row: Pick<StaffMemberRow, "displayName" | "email">): string {
  return row.displayName ?? row.email ?? "Name not set yet";
}
