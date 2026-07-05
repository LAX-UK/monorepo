import { saleIdParamSchema } from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import type { SaleAuxRouteDeps, SaleHono } from "./_shared.js";

export function attachSaleFollowRoutes(r: SaleHono, deps: SaleAuxRouteDeps): void {
  const { container, requireAuth } = deps;

  r.post("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const row = await container.saleFollowService.follow(userId, id);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ data: { isFollowing: true } });
  });

  r.delete("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    await container.saleFollowService.unfollow(userId, id);
    return c.json({ data: { isFollowing: false } });
  });

  r.get("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const isFollowing = await container.saleFollowService.isFollowing(userId, id);
    return c.json({ data: { isFollowing } });
  });
}
