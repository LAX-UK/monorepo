import type { UserRole } from "@auction/types";
import {
  attachLotToSaleBodySchema,
  cancelSaleBodySchema,
  createNestedLotForSaleSchema,
  saleIdParamSchema,
  saleLotIdParamSchema,
  updateLotStatusBodySchema,
} from "@auction/validators";
import { respondCatalogRouteOutcome } from "../../lib/catalog-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import type { SaleHono, SaleLotMembershipRouteDeps } from "./_shared.js";

export function attachSaleLotsRoutes(r: SaleHono, deps: SaleLotMembershipRouteDeps): void {
  const { container, requireAuth } = deps;
  const http = () => container.catalogRoutes.saleLotMembershipHttp;

  r.post(
    "/:id/lots",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", createNestedLotForSaleSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      return respondCatalogRouteOutcome(
        c,
        await http().addLot({ role, saleId: id, body, staffRole }),
        201,
      );
    },
  );

  r.post(
    "/:id/lots/attach/:lotId",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    zValidator("json", attachLotToSaleBodySchema.optional()),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id, lotId } = c.req.valid("param");
      const body = c.req.valid("json") ?? { via: "attach_endpoint" as const };
      return respondCatalogRouteOutcome(
        c,
        await http().attachExistingLot({
          role,
          saleId: id,
          lotId,
          staffRole,
          via: body.via ?? "attach_endpoint",
        }),
      );
    },
  );

  r.delete(
    "/:id/lots/:lotId",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id, lotId } = c.req.valid("param");
      const outcome = await http().detachLot({ role, saleId: id, lotId, staffRole });
      if (outcome.kind === "ok") return c.body(null, 204);
      return respondCatalogRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/:id/lots/:lotId/cancel",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    zValidator("json", cancelSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id, lotId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      return respondCatalogRouteOutcome(
        c,
        await http().cancelLotOnSale({
          userId,
          role,
          saleId: id,
          lotId,
          staffRole,
          ...(reason !== undefined ? { reason } : {}),
        }),
      );
    },
  );

  r.post(
    "/:id/lots/:lotId/status",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    zValidator("json", updateLotStatusBodySchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const userId = c.get("userId") as string;
      const { id, lotId } = c.req.valid("param");
      const { status, reason } = c.req.valid("json");
      return respondCatalogRouteOutcome(
        c,
        await http().setLotStatus({
          userId,
          role,
          saleId: id,
          lotId,
          staffRole,
          status,
          ...(reason !== undefined ? { reason } : {}),
        }),
      );
    },
  );
}
