# Changing your own staff roles (Bid admin)

Only an Administrator can change their own Bid staff roles. Anyone else who has been given role
management (`user.invite`) is refused with `cannot_change_own_role` (403) when they try to give
themselves a role or take one away.

## Where it applies

- **Staff-roles screen** (**Admin → Staff → person → Roles**, `POST /admin/staff/:userId/roles` and
  `/remove`): an Administrator may add or remove roles on their own record. The rule is
  `mayChangeOwnStaffRoles` in `@auction/types`, applied by `StaffRolesAdminService`. The roster still
  keeps at least one active Administrator, so removing your own Administrator role while you are the
  last one is refused with `last_administrator` (409).
- **Set-staff-role path** (`setStaffRole` in `admin-user.service.ts`, the People screen's role
  change): it refuses **every** change to your own staff role, Administrators included
  (`cannot_change_own_role`). This is deliberately stricter than the screen above. An Administrator
  who needs to change their own roles uses the staff-roles screen.

## What to do when someone is refused

1. Check who holds Administrator: **Admin → Staff**, filter by role.
2. If the person needs a role and is not an Administrator, ask an Administrator to give it on their
   record.
3. If an Administrator needs to step down, make sure another Administrator exists first; the last
   one cannot be removed.

Every role change is audited with who made it and why.
