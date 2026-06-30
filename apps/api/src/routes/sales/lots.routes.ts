import { type UserRole, normalizeUserStaffRole } from "@auction/types";
import {
  attachLotToSaleBodySchema,
  cancelSaleBodySchema,
  createNestedLotForSaleSchema,
  saleIdParamSchema,
  saleLotIdParamSchema,
  updateLotStatusBodySchema,
} from "@auction/validators";
import { serviceErrorJsonBody } from "../../lib/forbidden-response.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { presentLotImages } from "../../lib/media-presenters.js";
import { zValidator } from "../../lib/z-validator.js";
import type { SaleHono, SaleRouteDeps } from "./_shared.js";

export function attachSaleLotsRoutes(r: SaleHono, deps: SaleRouteDeps): void {
  const { container, requireAuth } = deps;

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
      const result = await container.saleService.addLot(role, id, body, staffRole);
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json(
        {
          data: await presentLotImages(
            container.mediaUrlResolver,
            result.value,
            container.mediaAssetEnricher,
          ),
        },
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
      const result = await container.saleService.attachExistingLot(
        role,
        id,
        lotId,
        staffRole,
        body.via,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentLotImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
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
      const result = await container.saleService.detachLot(role, id, lotId, staffRole);
      return result.match(
        () => c.body(null, 204),
        (error) => c.json(serviceErrorJsonBody(error), asHttpStatus(error.status)),
      );
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
      const lot = await container.lotService.getById(lotId);
      if (!lot || lot.saleId !== id) {
        return c.json({ error: "Lot not found in this sale" }, 404);
      }
      const result = await container.lotService.cancel(
        userId,
        role,
        lotId,
        normalizeUserStaffRole(staffRole ?? undefined),
        reason?.trim() ? "admin_override" : "manual",
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentLotImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
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
      const { id, lotId } = c.req.valid("param");
      const { status, reason } = c.req.valid("json");
      if (status === "cancelled") {
        const userId = c.get("userId") as string;
        const lot = await container.lotService.getById(lotId);
        if (!lot || lot.saleId !== id) {
          return c.json({ error: "Lot not found in this sale" }, 404);
        }
        const cancelResult = await container.lotService.cancel(
          userId,
          role,
          lotId,
          normalizeUserStaffRole(staffRole ?? undefined),
          reason?.trim() ? "admin_override" : "manual",
        );
        if (cancelResult.isErr()) {
          return c.json(
            serviceErrorJsonBody(cancelResult.error),
            asHttpStatus(cancelResult.error.status),
          );
        }
        return c.json({
          data: await presentLotImages(
            container.mediaUrlResolver,
            cancelResult.value,
            container.mediaAssetEnricher,
          ),
        });
      }
      const result = await container.saleStatusTransitionService.setLotStatus(
        role,
        id,
        lotId,
        status,
        reason,
        staffRole,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentLotImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
    },
  );
}
