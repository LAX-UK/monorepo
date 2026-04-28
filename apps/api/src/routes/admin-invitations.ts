import {
  adminCreateInvitationBodySchema,
  invitationIdUuidParamSchema,
  invitationPreviewQuerySchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";

export function attachAdminInvitationRoutes(
  r: Hono<{ Variables: { userId?: string; userRole?: string } }>,
  container: Container,
): void {
  r.post("/invitations", zValidator("json", adminCreateInvitationBodySchema), async (c) => {
    const actorId = c.get("userId") as string;
    const body = c.req.valid("json");
    const result = await container.invitationService.create({
      actorUserId: actorId,
      email: body.email,
      targetRole: body.targetRole,
    });
    return result.match(
      (data) => c.json({ data }, 201),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.get("/invitations", async (c) => {
    const data = await container.invitationService.listPendingForActor(c.get("userId") as string);
    return c.json({ data });
  });

  r.post("/invitations/:invitationId/revoke", zValidator("param", invitationIdUuidParamSchema), async (c) => {
    const actorId = c.get("userId") as string;
    const { invitationId } = c.req.valid("param");
    const result = await container.invitationService.revoke({ actorUserId: actorId, invitationId });
    return result.match(
      () => c.json({ ok: true }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.post("/invitations/:invitationId/resend", zValidator("param", invitationIdUuidParamSchema), async (c) => {
    const actorId = c.get("userId") as string;
    const { invitationId } = c.req.valid("param");
    const result = await container.invitationService.resend({ actorUserId: actorId, invitationId });
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });
}

export function createPublicInvitationRoutes(container: Container) {
  const r = new Hono();

  r.get("/preview", zValidator("query", invitationPreviewQuerySchema), async (c) => {
    const { token } = c.req.valid("query");
    const result = await container.invitationService.preview(token);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  return r;
}
