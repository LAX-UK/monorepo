import { createMiddleware } from "hono/factory";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createRequireAuth(authenticator: IAuthenticator) {
  return createMiddleware<{
    Variables: { userId: string };
  }>(async (c, next) => {
    const user = await authenticator.getSessionUser(c.req.raw.headers);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("userId", user.id);
    await next();
  });
}
