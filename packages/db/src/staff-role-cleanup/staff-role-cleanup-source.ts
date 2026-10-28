import type pg from "pg";
import type { StaffMemberRoles } from "./staff-role-cleanup-plan.js";

export type PendingStaffInvitation = { readonly email: string; readonly role: string };

/** A membership or pending invitation that still uses `specialist` or `staff`. */
export type RetiredOrganisationRoleUse = {
  readonly kind: "membership" | "invitation";
  readonly organisation: string;
  readonly person: string;
  readonly role: string;
};

/** What the clean-up report reads from the roster. Read-only. */
export interface StaffRoleCleanupSource {
  listStaffMembers(): Promise<StaffMemberRoles[]>;
  listPendingStaffInvitations(): Promise<PendingStaffInvitation[]>;
  listRetiredOrganisationRoleUse(): Promise<RetiredOrganisationRoleUse[]>;
}

type Queryable = Pick<pg.ClientBase, "query">;

/**
 * Reads the roster from Postgres. Every staff member's roles not yet ended, from their role
 * assignments, or from the single role on their Bid profile when they have none.
 */
export function createPgStaffRoleCleanupSource(db: Queryable): StaffRoleCleanupSource {
  return {
    async listStaffMembers() {
      const { rows } = await db.query<{
        user_id: string;
        name: string | null;
        email: string | null;
        roles: string[] | null;
      }>(
        `select p.user_id,
                d.name,
                d.email,
                coalesce(
                  (select array_agg(distinct a.role::text order by a.role::text)
                   from staff_role_assignment a
                   where a.user_id = p.user_id and (a.ends_at is null or a.ends_at > now())),
                  case when p.staff_role is null then array[]::text[]
                       else array[p.staff_role::text] end
                ) as roles
         from bid_user_profile p
         left join bid_identity_directory d on d.subject_id = p.user_id
         where p.role = 'staff'
         order by lower(coalesce(d.name, d.email, p.user_id)), p.user_id`,
      );
      return rows.map((row) => ({
        userId: row.user_id,
        name: row.name ?? "",
        email: row.email ?? "",
        roles: row.roles ?? [],
      }));
    },

    async listPendingStaffInvitations() {
      const { rows } = await db.query<{ email: string; role: string }>(
        `select email, target_staff_role::text as role
         from user_invitation
         where status = 'pending' and target_role = 'staff' and target_staff_role is not null
         order by lower(email)`,
      );
      return rows;
    },

    async listRetiredOrganisationRoleUse() {
      const { rows } = await db.query<RetiredOrganisationRoleUse>(
        `select 'membership' as kind, e.display_name as organisation,
                coalesce(d.email, m.user_id) as person,
                m.role::text || case when m.removed_at is null then '' else ' (removed)' end as role
         from legal_entity_member m
         join legal_entity e on e.id = m.legal_entity_id
         left join bid_identity_directory d on d.subject_id = m.user_id
         where m.role::text in ('specialist', 'staff')
         union all
         select 'invitation', coalesce(e.display_name, ''), i.email, i.target_legal_entity_member_role
         from user_invitation i
         left join legal_entity e on e.id = i.target_legal_entity_id
         where i.status = 'pending' and i.target_legal_entity_member_role in ('specialist', 'staff')
         order by 1, 2, 3`,
      );
      return rows;
    },
  };
}
