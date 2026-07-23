import type { CreateLotInput, UserRole } from "@auction/types";
import {
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  deleteLotBodySchema,
  lotIdParamSchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import { respondCatalogRouteOutcome } from "../../lib/catalog-route-response.js";
import { serviceErrorJsonBody } from "../../lib/forbidden-response.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import type { LotHono, LotRouteDeps } from "./_shared.js";

export function attachLotLifecycleRoutes(r: LotHono, deps: LotRouteDeps): void {
  const { container, requireAuth } = deps;
  const http = () => container.catalogRoutes.lotLifecycleHttp;

  r.post("/bulk", requireAuth, zValidator("json", bulkLotsBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const body = c.req.valid("json");
    const { ids, op, reason } = body;
    const bulkInput = {
      userId,
      role,
      ids,
      op,
      staffRole: c.get("userStaffRole"),
      ...(reason !== undefined ? { reason } : {}),
      ...("confirmationPhrase" in body && body.confirmationPhrase !== undefined
        ? { confirmationPhrase: body.confirmationPhrase }
        : {}),
    };
    return respondCatalogRouteOutcome(c, await http().bulkLots(bulkInput));
  });

  r.post("/:id/publish", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const { id } = c.req.valid("param");
    return respondCatalogRouteOutcome(
      c,
      await http().publish({ userId, role, lotId: id, staffRole: c.get("userStaffRole") }),
    );
  });

  r.post("/:id/withdraw-request", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const sellerUserId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const outcome = await http().requestWithdrawal({ sellerUserId, lotId: id });
    if (outcome.kind === "ok") {
      return c.json({ data: outcome.data }, outcome.data.alreadyPending ? 200 : 201);
    }
    return respondCatalogRouteOutcome(c, outcome);
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
      return respondCatalogRouteOutcome(
        c,
        await http().cancel({
          userId,
          role,
          lotId: id,
          staffRole: c.get("userStaffRole"),
          cancelReason: body.reason?.trim() ? "admin_override" : "manual",
        }),
      );
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
      const outcome = await http().softDelete({
        userId,
        role,
        lotId: id,
        confirmationPhrase,
        staffRole,
      });
      if (outcome.kind === "no_content") return c.body(null, 204);
      return c.json(
        serviceErrorJsonBody(outcome.error),
        asHttpStatus("status" in outcome.error ? (outcome.error.status as number) : 500),
      );
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
      return respondCatalogRouteOutcome(
        c,
        await http().update({ role, lotId: id, body, staffRole: c.get("userStaffRole") }),
      );
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
      return respondCatalogRouteOutcome(
        c,
        await http().updateMarketingDetails({
          role,
          lotId: id,
          body,
          staffRole: c.get("userStaffRole"),
        }),
      );
    },
  );

  r.post("/", requireAuth, zValidator("json", createLotSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    const userId = c.get("userId") as string;
    const body = c.req.valid("json") as CreateLotInput;
    return respondCatalogRouteOutcome(
      c,
      await http().create({ userId, role, body, staffRole: c.get("userStaffRole") }),
      201,
    );
  });
}
