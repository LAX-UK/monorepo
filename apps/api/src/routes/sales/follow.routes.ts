import { saleIdParamSchema } from "@auction/validators";
import { respondCatalogRouteOutcome } from "../../lib/catalog-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { SaleFollowRouteDeps, SaleHono } from "./_shared.js";

export function attachSaleFollowRoutes(r: SaleHono, deps: SaleFollowRouteDeps): void {
  const { container, requireAuth } = deps;
  const http = () => container.catalogRoutes.saleFollowHttp;

  r.post("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    return respondCatalogRouteOutcome(c, await http().follow({ userId, saleId: id }));
  });

  r.delete("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    return respondCatalogRouteOutcome(c, await http().unfollow({ userId, saleId: id }));
  });

  r.get("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    return respondCatalogRouteOutcome(c, await http().getStatus({ userId, saleId: id }));
  });
}
