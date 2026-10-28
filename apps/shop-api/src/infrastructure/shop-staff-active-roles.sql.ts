import type { Database } from "@auction/db";
import { shopStaffMember, shopStaffRoleAssignment, shopUserProfile } from "@auction/db/schema";
import {
  type ShopStaffCapability,
  type ShopStaffRole,
  rolesHaveCapability,
} from "@auction/shop-domain";
import { normalizeLaxAdminRoles } from "@auction/types";
import { type AnyColumn, type SQL, eq, isNull, sql } from "drizzle-orm";

/**
 * The LAX Admin roles a staff member holds in force right now, as an array (empty when none),
 * for any query keyed by the person's subject column. The one place that reads "in force", so a
 * session, an assignee list and a staff list agree on who can do what.
 */
export function activeShopStaffRolesSql(subjectColumn: AnyColumn | SQL): SQL<string[]> {
  return sql<string[]>`coalesce((
    select array_agg(distinct a.role::text)
    from ${shopStaffRoleAssignment} a
    where a.identity_subject_id = ${subjectColumn}
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  ), '{}'::text[])`;
}

/** One role a staff member holds or will hold, as lists show it. */
export type CurrentShopStaffRole = { role: string; startsAt: string; endsAt: string | null };

/** The person's assignments not ended yet (in force, or starting later), as JSON. */
export function currentShopStaffRolesSql(
  subjectColumn: AnyColumn | SQL,
): SQL<CurrentShopStaffRole[]> {
  return sql<CurrentShopStaffRole[]>`coalesce((
    select json_agg(json_build_object(
      'role', a.role::text,
      'startsAt', to_char(a.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'endsAt', to_char(a.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) order by a.starts_at)
    from ${shopStaffRoleAssignment} a
    where a.identity_subject_id = ${subjectColumn}
      and (a.ends_at is null or a.ends_at > now())
  ), '[]'::json)`;
}

/** Whether the person holds any of `roles` in force: the staff list's role filter. */
export function holdsAnyShopStaffRoleSql(
  subjectColumn: AnyColumn | SQL,
  roles: readonly string[],
): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${shopStaffRoleAssignment} a
    where a.identity_subject_id = ${subjectColumn}
      and a.role::text = any(${`{${roles.join(",")}}`}::text[])
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
  )`;
}

/** An active staff member who holds a capability, with the roles that give it. */
export type StaffHoldingCapability = {
  readonly subject: string;
  readonly name: string | null;
  readonly email: string | null;
  /** Every role in force, in role order; never empty. */
  readonly roles: readonly ShopStaffRole[];
  /** The primary role, for a label. */
  readonly role: ShopStaffRole;
};

/** Active staff whose roles in force include `capability`: assignee and reviewer pickers. */
export async function listStaffHoldingCapability(
  db: Database,
  capability: ShopStaffCapability,
): Promise<StaffHoldingCapability[]> {
  const rows = await db
    .select({
      subject: shopStaffMember.identitySubjectId,
      roles: activeShopStaffRolesSql(shopStaffMember.identitySubjectId),
      name: shopUserProfile.name,
      email: shopUserProfile.email,
    })
    .from(shopStaffMember)
    .leftJoin(
      shopUserProfile,
      eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
    )
    .where(isNull(shopStaffMember.disabledAt));
  return rows.flatMap((row) => {
    const roles = normalizeLaxAdminRoles(row.roles);
    const [role] = roles;
    if (!role || !rolesHaveCapability(roles, capability)) return [];
    return [{ subject: row.subject, name: row.name, email: row.email, roles, role }];
  });
}
