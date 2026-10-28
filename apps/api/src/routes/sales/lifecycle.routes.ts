import type { UserRole } from "@auction/types";
import {
  bulkSalesBodySchema,
  cancelSaleBodySchema,
  createSaleSchema,
  deleteSaleBodySchema,
  markSaleEndedBodySchema,
  saleIdParamSchema,
  updateSaleSchema,
} from "@auction/validators";
import { respondCatalogRouteOutcome } from "../../lib/catalog-route-response.js";
import { serviceErrorJsonBody } from "../../lib/forbidden-response.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import type { SaleHono, SaleLifecycleWriteRouteDeps } from "./_shared.js";

export function attachSaleLifecycleRoutes(r: SaleHono, deps: SaleLifecycleWriteRouteDeps): void {
  const { container, requireAuth } = deps;
  const http = () => container.catalogRoutes.saleLifecycleHttp;

  r.post("/bulk", requireAuth, zValidator("json", bulkSalesBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRoles = c.get("userStaffRoles");
    const { ids, confirmationPhrase } = c.req.valid("json");
    return respondCatalogRouteOutcome(
      c,
      await http().bulkSoftDelete({ userId, role, ids, confirmationPhrase, staffRoles }),
    );
  });

  r.post("/", requireAuth, zValidator("json", createSaleSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    return respondCatalogRouteOutcome(
      c,
      await http().createSale({
        userId,
        role,
        staffRoles: c.get("userStaffRoles"),
        body,
      }),
      201,
    );
  });

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", updateSaleSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRoles = c.get("userStaffRoles");
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      return respondCatalogRouteOutcome(
        c,
        await http().updateDraft({ role, saleId: id, patch, staffRoles }),
      );
    },
  );

  r.post("/:id/publish", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRoles = c.get("userStaffRoles");
    const { id } = c.req.valid("param");
    return respondCatalogRouteOutcome(
      c,
      await http().publish({ userId, role, saleId: id, staffRoles }),
    );
  });

  r.post("/:id/unpublish", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRoles = c.get("userStaffRoles");
    const { id } = c.req.valid("param");
    return respondCatalogRouteOutcome(
      c,
      await http().unpublish({ userId, role, saleId: id, staffRoles }),
    );
  });

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", cancelSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRoles = c.get("userStaffRoles");
      const { id } = c.req.valid("param");
      return respondCatalogRouteOutcome(
        c,
        await http().cancel({ userId, role, saleId: id, staffRoles }),
      );
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
      const staffRoles = c.get("userStaffRoles");
      const { id } = c.req.valid("param");
      const { confirmationPhrase } = c.req.valid("json");
      const outcome = await http().softDelete({
        userId,
        role,
        saleId: id,
        confirmationPhrase,
        staffRoles,
      });
      if (outcome.kind === "no_content") return c.body(null, 204);
      return c.json(
        serviceErrorJsonBody(outcome.error),
        asHttpStatus("status" in outcome.error ? (outcome.error.status as number) : 500),
      );
    },
  );

  r.post(
    "/:id/mark-ended",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", markSaleEndedBodySchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRoles = c.get("userStaffRoles");
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      return respondCatalogRouteOutcome(
        c,
        await http().markOnsiteSaleEnded({
          userId,
          role,
          saleId: id,
          reason: reason ?? "",
          staffRoles,
        }),
      );
    },
  );
}
