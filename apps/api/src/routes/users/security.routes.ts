import { z } from "zod";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

const deleteAccountBodySchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

const sessionIdParamSchema = z.object({
  sessionId: z.string().min(8, "Invalid session id"),
});

export function attachUserSecurityRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth, requirePasswordStepUp, requireSessionRevokeAuth } = deps;

  r.get("/me/sessions", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.securityHttp.listSessions({
      userId,
      sessionTokenFromCookie: c.get("identitySessionId") ?? null,
    });
    return respondUserHttpJson(c, response);
  });

  r.delete(
    "/me/sessions/:sessionId",
    requireAuth,
    requireSessionRevokeAuth,
    zValidator("param", sessionIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { sessionId } = c.req.valid("param");
      const response = await container.userRoutes.securityHttp.deleteSession({
        userId,
        sessionId,
        sessionTokenFromCookie: c.get("identitySessionId") ?? null,
      });
      return respondUserHttpJson(c, response);
    },
  );

  r.post("/me/sessions/revoke-all", requireAuth, requireSessionRevokeAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.securityHttp.revokeAllSessionsExceptCurrent({
      userId,
      sessionTokenFromCookie: c.get("identitySessionId") ?? null,
    });
    return respondUserHttpJson(c, response);
  });

  r.post("/me/security-notify/two-factor-enabled", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.securityHttp.notifyTwoFactorEnabled({ userId });
    return respondUserHttpJson(c, response);
  });

  r.post("/me/security-notify/two-factor-disabled", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const response = await container.userRoutes.securityHttp.notifyTwoFactorDisabled({ userId });
    return respondUserHttpJson(c, response);
  });

  r.post(
    "/me/delete",
    requireAuth,
    requirePasswordStepUp,
    zValidator("json", deleteAccountBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const response = await container.userRoutes.securityHttp.requestAccountDeletion({ userId });
      return respondUserHttpJson(c, response);
    },
  );
}
