import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { userStaffRoles } from "@auction/types";
import { z } from "zod";

const roleSchema = z.object({
  id: z.string(),
  role: z.enum(userStaffRoles),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  grantedAt: z.string(),
  reason: z.string().nullable(),
});

const overviewSchema = z.object({
  userId: z.string(),
  assignments: z.array(roleSchema),
  otherActiveAdministrators: z.number().int().nonnegative(),
});

const reviewRowSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  suspended: z.boolean(),
  lastSignInAt: z.string().nullable(),
  roles: z.array(roleSchema),
});

/** One role a person holds or will hold; dates are ISO strings. */
export type StaffRoleAssignmentView = z.infer<typeof roleSchema>;
export type StaffRolesOverview = z.infer<typeof overviewSchema>;
export type StaffAccessReviewRow = z.infer<typeof reviewRowSchema>;

async function readData<T>(res: Response, schema: z.ZodType<T>): Promise<T | null> {
  if (!res.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = schema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}

/** A staff member's roles, or null when they could not be read. */
export async function getServerStaffRoles(userId: string): Promise<StaffRolesOverview | null> {
  const res = await authedServerFetch(`/admin/staff/${encodeURIComponent(userId)}/roles`, {
    cache: "no-store",
  });
  return readData(res, overviewSchema);
}

/** Every staff member's roles and last sign-in; throws when the review could not be read. */
export async function getServerStaffAccessReview(): Promise<StaffAccessReviewRow[]> {
  const res = await authedServerFetch("/admin/staff/access-review", { cache: "no-store" });
  const rows = await readData(res, z.array(reviewRowSchema));
  if (!rows) throw new Error("The access review did not load.");
  return rows;
}
