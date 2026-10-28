import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import type { Context } from "hono";
import type { Result } from "neverthrow";
import { z } from "zod";
import type { ContainerAdminMyStaffToolsRoutesSlice } from "../../container.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { STAFF_TOOLS_READ_SCOPE } from "../../middleware/bid-scope-policy.js";
import { createRequireAuth } from "../../middleware/require-auth.js";
import { requireUserInvite } from "../../middleware/require-capability.js";
import {
  STAFF_ACCESS_SUMMARY_BATCH,
  type StaffAccessActor,
  type StaffAccessAdminService,
  type StaffAccessError,
} from "../../services/admin/staff-access-admin.service.js";
import type { IAuthenticator } from "../../services/interfaces/authenticator.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

const summariesBodySchema = z.object({
  subjectIds: z.array(z.string().min(1)).max(STAFF_ACCESS_SUMMARY_BATCH),
});
const subjectParamSchema = z.object({ userId: z.string().min(1) });
const remoteProductParamSchema = subjectParamSchema.extend({ product: z.literal("shop") });
const roleBodySchema = z.object({ role: z.string().min(1) });

function actorOf(c: Context): StaffAccessActor {
  return {
    userId: c.get("userId") as string,
    role: (c.get("userRole") as string | undefined) ?? "client",
    staffRoles: c.get("userStaffRoles"),
  };
}

function respond<T>(c: Context, result: Result<T, StaffAccessError>, status: 200 | 201 = 200) {
  return result.match(
    (data) => c.json({ data }, status),
    (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
  );
}

/**
 * The signed-in person's own staff tools, for the product switcher. It answers only about the
 * caller, so it takes no subject id. It is mounted outside the platform shell gate because
 * finance staff, who fail it, still open Bid admin and need the answer, and it also accepts the
 * read-only `lax.staff.tools.read` token LAX Admin exchanges for on the person's behalf.
 */
export function createAdminMyStaffToolsRoutes(
  container: ContainerAdminMyStaffToolsRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireStaffToolsRead = createRequireAuth(authenticator, {
    isSuspended: (id) => container.admin.requestLifecycle.isSuspended(id),
    acceptedScopes: ["bid.read", STAFF_TOOLS_READ_SCOPE],
  });
  const routes = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  routes.get("/", requireStaffToolsRead, async (c) =>
    c.json({ data: { tools: await container.admin.staffAccess.myTools(actorOf(c)) } }),
  );
  return routes;
}

/** Cross-platform staff access for the Bid People screen (D36). */
export function attachAdminStaffAccessRoutes(
  platform: AdminHono,
  staffAccess: Pick<
    StaffAccessAdminService,
    "summaries" | "detail" | "setRemoteRole" | "revokeRemote"
  >,
  guards: AdminStaffMutationGuards,
): void {
  platform.post("/staff/access/summaries", zValidator("json", summariesBodySchema), async (c) =>
    respond(c, await staffAccess.summaries(actorOf(c), c.req.valid("json").subjectIds)),
  );

  platform.get("/staff/:userId/access", zValidator("param", subjectParamSchema), async (c) =>
    respond(c, await staffAccess.detail(actorOf(c), c.req.valid("param").userId)),
  );

  platform.put(
    "/staff/:userId/access/:product",
    requireUserInvite,
    guards.requireStepUp,
    zValidator("param", remoteProductParamSchema),
    zValidator("json", roleBodySchema),
    async (c) => {
      const { userId, product } = c.req.valid("param");
      const { role } = c.req.valid("json");
      return respond(c, await staffAccess.setRemoteRole(actorOf(c), userId, product, role));
    },
  );

  platform.delete(
    "/staff/:userId/access/:product",
    requireUserInvite,
    guards.requireStepUp,
    zValidator("param", remoteProductParamSchema),
    async (c) => {
      const { userId, product } = c.req.valid("param");
      return respond(c, await staffAccess.revokeRemote(actorOf(c), userId, product));
    },
  );
}
