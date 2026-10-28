import { laxShopStaffRoles, userStaffRoles } from "@auction/types";
import { z } from "zod";

/** Every role change is audited with a reason someone else can follow later. */
export const STAFF_ROLE_REASON_MIN = 3;
export const STAFF_ROLE_REASON_MAX = 500;

const reasonSchema = z.string().trim().min(STAFF_ROLE_REASON_MIN).max(STAFF_ROLE_REASON_MAX);

/** Give a staff member one more role, until removed or until `endsAt`. */
export const adminAssignStaffRoleBodySchema = z.object({
  role: z.enum(userStaffRoles),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  reason: reasonSchema,
});

/** End a role a staff member holds, now. */
export const adminRemoveStaffRoleBodySchema = z.object({
  role: z.enum(userStaffRoles),
  reason: reasonSchema,
});

/** Give a person one more LAX Admin role, until removed or until `endsAt`. */
export const adminAssignLaxAdminRoleBodySchema = z.object({
  role: z.enum(laxShopStaffRoles),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  reason: reasonSchema,
});

/** End a LAX Admin role a person holds, now. */
export const adminRemoveLaxAdminRoleBodySchema = z.object({
  role: z.enum(laxShopStaffRoles),
  reason: reasonSchema,
});

export type AdminAssignLaxAdminRoleBody = z.infer<typeof adminAssignLaxAdminRoleBodySchema>;
export type AdminRemoveLaxAdminRoleBody = z.infer<typeof adminRemoveLaxAdminRoleBodySchema>;
export type AdminAssignStaffRoleBody = z.infer<typeof adminAssignStaffRoleBodySchema>;
export type AdminRemoveStaffRoleBody = z.infer<typeof adminRemoveStaffRoleBodySchema>;
