import { zValidator } from "../../lib/z-validator.js";
import { requirePlatformAdminFull } from "../../middleware/require-capability.js";
import type { AdminPeopleImpersonationRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import {
  impersonationLookupQuerySchema,
  impersonationRecordFailedEndBodySchema,
  impersonationStartBodySchema,
} from "./_schemas.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminImpersonationRoutes(
  platform: AdminHono,
  container: AdminPeopleImpersonationRoutesContainer,
): void {
  platform.get(
    "/impersonation/lookup",
    requirePlatformAdminFull,
    zValidator("query", impersonationLookupQuerySchema),
    async (c) => {
      const { legalEntityId } = c.req.valid("query");
      const out = await container.admin.impersonation.lookupForImpersonation(legalEntityId);
      if (!out.ok) return c.json({ error: "Not found" }, 404);
      return c.json({ data: out.data });
    },
  );

  platform.post(
    "/impersonation/record-failed-end",
    requirePlatformAdminFull,
    zValidator("json", impersonationRecordFailedEndBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { sessionId, legalEntityId } = c.req.valid("json");
      const out = await container.admin.impersonation.recordFailedEnd({
        actorUserId: userId,
        sessionId,
        legalEntityId,
      });
      if (!out.ok) {
        return c.json({ error: out.error }, out.status);
      }
      if (out.alreadyEnded) return c.json({ ok: true, alreadyEnded: true });
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/impersonation/start",
    requirePlatformAdminFull,
    zValidator("json", impersonationStartBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { legalEntityId } = c.req.valid("json");
      const out = await container.admin.impersonation.startImpersonation({
        actorUserId: userId,
        legalEntityId,
        cookieHeader: c.req.header("Cookie"),
      });
      if (!out.ok) {
        return c.json(
          out.error === "not_impersonation"
            ? { error: out.error, message: out.message }
            : { error: out.error },
          out.status,
        );
      }
      return c.json({ data: out.data });
    },
  );

  platform.post("/impersonation/end", requirePlatformAdminFull, async (c) => {
    const userId = c.get("userId") as string;
    const out = await container.admin.impersonation.endImpersonation({
      actorUserId: userId,
      cookieHeader: c.req.header("Cookie"),
    });
    if (!out.ok) {
      return c.json({ error: "no_active_impersonation" }, 400);
    }
    return c.json({ ok: true });
  });
}
