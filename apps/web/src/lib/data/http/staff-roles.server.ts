import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { laxShopStaffRoles, userStaffRoles } from "@auction/types";
import { z } from "zod";

const period = {
  id: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  grantedAt: z.string(),
  reason: z.string().nullable(),
};

const roleSchema = z.object({ ...period, role: z.enum(userStaffRoles) });

const laxAdminRoleSchema = z.object({
  ...period,
  role: z.enum(laxShopStaffRoles),
  /** A change asked for that LAX Admin has not applied yet. */
  pending: z.enum(["assign", "remove"]).nullable().optional(),
});

const overviewSchema = z.object({
  userId: z.string(),
  assignments: z.array(roleSchema),
  otherActiveAdministrators: z.number().int().nonnegative(),
});

const laxAdminOverviewSchema = z
  .object({
    userId: z.string(),
    roles: z.array(laxAdminRoleSchema),
    otherActiveAdministrators: z.number().int().nonnegative(),
  })
  .transform(({ roles, ...rest }) => ({ ...rest, assignments: roles }));

const reviewRowSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  suspended: z.boolean(),
  lastSignInAt: z.string().nullable(),
  roles: z.array(roleSchema),
  laxAdminRoles: z.array(laxAdminRoleSchema).default([]),
});

/** One Bid role a person holds or will hold; dates are ISO strings. */
export type StaffRoleAssignmentView = z.infer<typeof roleSchema>;
/** One LAX Admin role a person holds, will hold, or is waiting for. */
export type LaxAdminRoleAssignmentView = z.infer<typeof laxAdminRoleSchema>;
export type StaffRolesOverview = z.infer<typeof overviewSchema>;
export type LaxAdminRolesOverview = z.infer<typeof laxAdminOverviewSchema>;
export type StaffAccessReviewRow = z.infer<typeof reviewRowSchema>;

async function readData<T>(res: Response, schema: z.ZodType<T, z.ZodTypeDef, unknown>) {
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = schema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

/** A staff member's Bid roles, or null when they could not be read. */
export async function getServerStaffRoles(userId: string): Promise<StaffRolesOverview | null> {
  const res = await authedServerFetch(`/admin/staff/${encodeURIComponent(userId)}/roles`, {
    cache: "no-store",
  });
  return readData(res, overviewSchema);
}

/** A person's LAX Admin roles, or null when they could not be read. */
export async function getServerLaxAdminRoles(
  userId: string,
): Promise<LaxAdminRolesOverview | null> {
  const res = await authedServerFetch(
    `/admin/staff/${encodeURIComponent(userId)}/lax-admin-roles`,
    { cache: "no-store" },
  );
  return readData(res, laxAdminOverviewSchema);
}

/** Every staff member's roles on both admins and last sign-in; throws when it could not load. */
export async function getServerStaffAccessReview(): Promise<StaffAccessReviewRow[]> {
  const res = await authedServerFetch("/admin/staff/access-review", { cache: "no-store" });
  const rows = await readData(res, z.array(reviewRowSchema));
  if (!rows) throw new Error("The access review did not load.");
  return rows;
}
