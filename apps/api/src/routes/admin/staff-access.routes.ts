import type { Context } from "hono";
import type { Result } from "neverthrow";
import { z } from "zod";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  STAFF_ACCESS_SUMMARY_BATCH,
  type StaffAccessActor,
  type StaffAccessAdminService,
  type StaffAccessError,
} from "../../services/admin/staff-access-admin.service.js";
import type { AdminHono } from "./_shared.js";

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
    staffRole: c.get("userStaffRole") as string | null | undefined,
  };
}

function respond<T>(c: Context, result: Result<T, StaffAccessError>, status: 200 | 201 = 200) {
  return result.match(
    (data) => c.json({ data }, status),
    (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
  );
}

/** Cross-platform staff access for the Bid People screen (D36). */
export function attachAdminStaffAccessRoutes(
  platform: AdminHono,
  staffAccess: Pick<
    StaffAccessAdminService,
    "summaries" | "detail" | "setRemoteRole" | "revokeRemote"
  >,
): void {
  platform.post("/staff/access/summaries", zValidator("json", summariesBodySchema), async (c) =>
    respond(c, await staffAccess.summaries(actorOf(c), c.req.valid("json").subjectIds)),
  );

  platform.get("/staff/:userId/access", zValidator("param", subjectParamSchema), async (c) =>
    respond(c, await staffAccess.detail(actorOf(c), c.req.valid("param").userId)),
  );

  platform.put(
    "/staff/:userId/access/:product",
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
    zValidator("param", remoteProductParamSchema),
    async (c) => {
      const { userId, product } = c.req.valid("param");
      return respond(c, await staffAccess.revokeRemote(actorOf(c), userId, product));
    },
  );
}
