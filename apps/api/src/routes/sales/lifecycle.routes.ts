import { type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import {
  bulkSalesBodySchema,
  cancelSaleBodySchema,
  createSaleSchema,
  deleteSaleBodySchema,
  markSaleEndedBodySchema,
  saleIdParamSchema,
  updateSaleSchema,
} from "@auction/validators";
import { LotError } from "../../lib/errors.js";
import { serviceErrorJsonBody } from "../../lib/forbidden-response.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { presentSaleImages, presentSalesWithLotsImages } from "../../lib/media-presenters.js";
import { zValidator } from "../../lib/z-validator.js";
import type { SaleHono, SaleLifecycleWriteRouteDeps } from "./_shared.js";

export function attachSaleLifecycleRoutes(r: SaleHono, deps: SaleLifecycleWriteRouteDeps): void {
  const { container, requireAuth } = deps;

  r.post("/bulk", requireAuth, zValidator("json", bulkSalesBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRole = c.get("userStaffRole") ?? null;
    const { ids, confirmationPhrase } = c.req.valid("json");
    const result = await container.saleSoftDeleteService.bulkSoftDelete(
      userId,
      role,
      ids,
      confirmationPhrase,
      staffRole,
    );
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    const { attempted, failed, errors } = result.value;
    return c.json({ data: { attempted, failed, errors } });
  });

  r.post("/", requireAuth, zValidator("json", createSaleSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (!roleHasCapability(role, "auction.manage", staff)) {
      return c.json({ error: "Only staff with auction.manage can create sales" }, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    try {
      const sale = await container.saleService.create(userId, body);
      return c.json(
        {
          data: await presentSaleImages(
            container.mediaUrlResolver,
            sale,
            container.mediaAssetEnricher,
          ),
        },
        201,
      );
    } catch (e) {
      if (e instanceof LotError) {
        return c.json({ error: e.message }, asHttpStatus(e.status));
      }
      throw e;
    }
  });

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", updateSaleSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const result = await container.saleService.updateDraft(role, id, patch, staffRole);
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSaleImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
    },
  );

  r.post("/:id/publish", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRole = c.get("userStaffRole") ?? null;
    const { id } = c.req.valid("param");
    const result = await container.saleService.publish(userId, role, id, staffRole);
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    const data = await presentSalesWithLotsImages(container.mediaUrlResolver, [result.value]);
    return c.json({ data: data[0] });
  });

  r.post("/:id/unpublish", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRole = c.get("userStaffRole") ?? null;
    const { id } = c.req.valid("param");
    const result = await container.saleService.unpublish(userId, role, id, staffRole);
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    return c.json({
      data: await presentSaleImages(
        container.mediaUrlResolver,
        result.value,
        container.mediaAssetEnricher,
      ),
    });
  });

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", cancelSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const result = await container.saleService.cancel(userId, role, id, staffRole);
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.json({
        data: await presentSaleImages(
          container.mediaUrlResolver,
          result.value,
          container.mediaAssetEnricher,
        ),
      });
    },
  );

  r.post(
    "/:id/delete",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", deleteSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const { confirmationPhrase } = c.req.valid("json");
      const result = await container.saleSoftDeleteService.softDelete(
        userId,
        role,
        id,
        confirmationPhrase,
        staffRole,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      return c.body(null, 204);
    },
  );

  r.post(
    "/:id/mark-ended",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", markSaleEndedBodySchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const result = await container.saleStatusTransitionService.markOnsiteSaleEnded(
        role,
        id,
        reason,
        staffRole,
        userId,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      const data = await presentSalesWithLotsImages(container.mediaUrlResolver, [result.value]);
      return c.json({ data: data[0] });
    },
  );
}
