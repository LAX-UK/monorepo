import {
  adminBulkInvitationsBodySchema,
  adminCreateInvitationBodySchema,
  invitationIdUuidParamSchema,
  invitationPreviewQuerySchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { asHttpStatus } from "../lib/http-status.js";
import type { IAdminInvitationApplicationService } from "../services/interfaces/admin-routes.js";

export function attachAdminInvitationRoutes(
  r: Hono<{ Variables: { userId?: string; userRole?: string } }>,
  invitations: IAdminInvitationApplicationService,
): void {
  r.post("/invitations", zValidator("json", adminCreateInvitationBodySchema), async (c) => {
    const actorId = c.get("userId") as string;
    const body = c.req.valid("json");
    const result = await invitations.create({
      actorUserId: actorId,
      email: body.email,
      targetRole: body.targetRole,
      ...(body.targetStaffRole != null ? { targetStaffRole: body.targetStaffRole } : {}),
    });
    return result.match(
      (data) => c.json({ data }, 201),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.get("/invitations", async (c) => {
    const data = await invitations.listPendingForActor(c.get("userId") as string);
    return c.json({ data });
  });

  r.post("/invitations/bulk", zValidator("json", adminBulkInvitationsBodySchema), async (c) => {
    const actorUserId = c.get("userId") as string;
    const { ids, op } = c.req.valid("json");
    for (const invitationId of ids) {
      const result =
        op === "revoke"
          ? await invitations.revoke({ actorUserId, invitationId })
          : await invitations.resend({ actorUserId, invitationId });
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
    }
    return c.json({ ok: true, data: { count: ids.length } });
  });

  r.post(
    "/invitations/:invitationId/revoke",
    zValidator("param", invitationIdUuidParamSchema),
    async (c) => {
      const actorId = c.get("userId") as string;
      const { invitationId } = c.req.valid("param");
      const result = await invitations.revoke({
        actorUserId: actorId,
        invitationId,
      });
      return result.match(
        () => c.json({ ok: true }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/invitations/:invitationId/resend",
    zValidator("param", invitationIdUuidParamSchema),
    async (c) => {
      const actorId = c.get("userId") as string;
      const { invitationId } = c.req.valid("param");
      const result = await invitations.resend({
        actorUserId: actorId,
        invitationId,
      });
      return result.match(
        (data) => c.json({ data }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );
}

export function createPublicInvitationRoutes(invitations: IAdminInvitationApplicationService) {
  const r = new Hono();

  r.get("/preview", zValidator("query", invitationPreviewQuerySchema), async (c) => {
    const { token } = c.req.valid("query");
    const result = await invitations.preview(token);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  return r;
}
