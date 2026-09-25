import { userIdParamSchema } from "@auction/validators";
import { respondUserHttpJson } from "../../lib/user-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

export function attachUserPublicRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container } = deps;

  r.get("/public/artists", async (c) => {
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(c.req.query("limit") ?? "24", 10) || 24),
    );
    const offset = Math.max(0, Number.parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const response = await container.userRoutes.publicHttp.listPublicArtists({ limit, offset });
    return respondUserHttpJson(c, response);
  });

  r.get("/public/:userId", zValidator("param", userIdParamSchema), async (c) => {
    const { userId: id } = c.req.valid("param");
    const response = await container.userRoutes.publicHttp.getPublicUserProfile({ userId: id });
    return respondUserHttpJson(c, response);
  });
}
