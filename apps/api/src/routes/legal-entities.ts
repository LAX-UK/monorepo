import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { parseActingLegalEntityCookieFromHeader } from "../lib/impersonation-cookie.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const legalEntityIdParamSchema = z.object({
  id: z.string().uuid(),
});

export function createLegalEntityRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  /** GET /legal-entities/me — list every active membership for the user. */
  r.get("/me", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const memberships = await container.legalEntityRepository.listActiveMembershipsForUser(userId);
    return c.json({ data: memberships });
  });

  /** GET /legal-entities/:id — full legal entity row.
   * Caller must be an active member; non-members get 403 (not 404, to avoid
   * leaking existence).
   */
  r.get("/:id", requireAuth, zValidator("param", legalEntityIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const userRole = c.get("userRole");
    const { id } = c.req.valid("param");
    const result = await container.legalEntityAccessService.getLegalEntityDetailForUser({
      userId,
      userRole,
      legalEntityId: id,
      actingLegalEntityCookie: parseActingLegalEntityCookieFromHeader(c.req.header("Cookie")),
    });
    return c.json(result.body, result.status);
  });

  return r;
}

/** Mounted under /users to keep the user-preference endpoint colocated with
 * other `/users/me/*` endpoints.
 */
export function createActingContextUserRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  /** POST /users/me/acting-context-tooltip — mark first-time tooltip dismissed. */
  r.post("/me/acting-context-tooltip", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    await container.userService.markActingContextTooltipSeen(userId);
    return c.json({ data: { dismissed: true } });
  });

  return r;
}
