import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";

export function createUserRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator);
  const r = new Hono<{ Variables: { userId: string } }>();

  r.get("/me", requireAuth, async (c) => {
    const userId = c.get("userId");
    const row = await container.userService.getById(userId);
    if (!row) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({ data: { id: row.id, role: row.role } });
  });

  return r;
}
