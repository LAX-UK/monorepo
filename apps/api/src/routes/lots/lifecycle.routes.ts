import { type CreateLotInput, type UserRole, normalizeUserStaffRole } from "@auction/types";
import {
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  deleteLotBodySchema,
  lotIdParamSchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import type { Context } from "hono";
import { canManageCatalogue } from "../../lib/catalogue-auth.js";
import { type AuthzError, LotError, missingCatalogueCapabilityError } from "../../lib/errors.js";
import { serviceErrorJsonBody } from "../../lib/forbidden-response.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { presentLotImages } from "../../lib/media-presenters.js";
import { zValidator } from "../../lib/z-validator.js";
import type { LotHono, LotRouteDeps } from "./_shared.js";

function jsonLotOrAuthzError(c: Context, e: LotError | AuthzError) {
  if (e instanceof LotError && e.code) {
    return c.json({ error: e.message, code: e.code }, asHttpStatus(e.status));
  }
  return c.json({ error: e.message }, asHttpStatus(e.status));
}

export function attachLotLifecycleRoutes(r: LotHono, deps: LotRouteDeps): void {
  const { container, requireAuth } = deps;

  r.post("/bulk", requireAuth, zValidator("json", bulkLotsBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const body = c.req.valid("json");
    const { ids, op, reason } = body;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);

    if (op === "soft_delete") {
      const result = await container.lotSoftDeleteService.bulkSoftDelete(
        userId,
        role,
        ids,
        body.confirmationPhrase ?? "",
        staff,
      );
      if (result.isErr()) {
        return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
      }
      const { attempted, failed, errors, orphanDraftSales } = result.value;
      return c.json({
        data: { attempted, failed, errors, orphanDraftSales },
      });
    }

    const result = await container.lotService.bulkPublishOrCancel(
      userId,
      role,
      ids,
      op,
      staff,
      reason,
    );
    if (result.isErr()) {
      return c.json(serviceErrorJsonBody(result.error), asHttpStatus(result.error.status));
    }
    const { attempted, failed, errors } = result.value;
    return c.json({
      data: { attempted, failed, errors },
    });
  });

  r.post("/:id/publish", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const { id } = c.req.valid("param");
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    const result = await container.lotService.publish(userId, role, id, staff);
    if (result.isErr()) {
      return jsonLotOrAuthzError(c, result.error);
    }
    return c.json({
      data: await presentLotImages(
        container.mediaUrlResolver,
        result.value,
        container.mediaAssetEnricher,
      ),
    });
  });

  r.post("/:id/withdraw-request", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const sellerUserId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const result = await container.lotService.requestWithdrawal(sellerUserId, id);
    if (result.isErr()) {
      return jsonLotOrAuthzError(c, result.error);
    }
    return c.json({ data: result.value }, result.value.alreadyPending ? 200 : 201);
  });

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", cancelLotBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const result = await container.lotService.cancel(
        userId,
        role,
        id,
        staff,
        body.reason?.trim() ? "admin_override" : "manual",
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
    "/:id/delete",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", deleteLotBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const { confirmationPhrase } = c.req.valid("json");
      const result = await container.lotSoftDeleteService.softDelete(
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

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", updateLotSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json") as Partial<CreateLotInput>;
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const result = await container.lotService.update(role, id, body, staff);
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

  r.put(
    "/:id/marketing-details",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", updateLotMarketingDetailsSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const result = await container.lotService.updateMarketingDetails(role, id, body, staff);
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

  r.post("/", requireAuth, zValidator("json", createLotSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (!canManageCatalogue(role, staff)) {
      const e = missingCatalogueCapabilityError(
        "Only staff with auction.manage or catalogue.write can create lots",
        role,
        staff,
      );
      return c.json(serviceErrorJsonBody(e), asHttpStatus(e.status));
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json") as CreateLotInput;
    if (!body.sellerLegalEntityId) {
      return c.json({ error: "sellerLegalEntityId is required" }, 400);
    }
    const result = await container.lotService.create(userId, body);
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
  });
}
