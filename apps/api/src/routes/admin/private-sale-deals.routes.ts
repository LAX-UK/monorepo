import {
  PRIVATE_SALE_DEALS_FINANCE_ACCESS,
  PRIVATE_SALE_DEALS_MANAGE_ACCESS,
  PRIVATE_SALE_DEALS_READ_ACCESS,
  PRIVATE_SALE_DEALS_RELEASE_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import {
  adminDealActionSchema,
  adminDealBuyerSchema,
  adminDealListQuerySchema,
  adminDealTermsPatchSchema,
  privateSaleActionParamSchema,
  privateSaleRefParamSchema,
} from "@auction/validators";
import type { Context } from "hono";
import { zValidator } from "../../lib/z-validator.js";
import { createRequireAccess } from "../../middleware/require-capability.js";
import type { AdminEnquiryRoutesContainer } from "../../services/interfaces/admin-routes/index.js";
import type { DealWriteError } from "../../services/interfaces/private-sale-deal-desk.js";
import type { DealStaffViewer } from "../../services/private-sale-deal/deal-staff-permissions.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

const requireDealsRead = createRequireAccess(PRIVATE_SALE_DEALS_READ_ACCESS);

/** What the signed-in person may do on a deal, from their capabilities. */
function viewerOf(c: Context): DealStaffViewer {
  const role = c.get("userRole") as UserRole;
  const staff = c.get("userStaffRoles") as StaffRoles | undefined;
  return {
    userId: c.get("userId") as string,
    abilities: {
      manage: userHasAccessTo(role, staff, PRIVATE_SALE_DEALS_MANAGE_ACCESS),
      finance: userHasAccessTo(role, staff, PRIVATE_SALE_DEALS_FINANCE_ACCESS),
      release: userHasAccessTo(role, staff, PRIVATE_SALE_DEALS_RELEASE_ACCESS),
    },
  };
}

const WRITE_ERROR_STATUS = {
  deal_not_found: 404,
  stale_version: 409,
  forbidden: 403,
  term_locked: 409,
  vat_treatment_not_allowed: 422,
  buyer_invalid: 422,
  buyer_locked: 409,
  buyer_is_seller: 422,
  blocked: 422,
  payment_in_progress: 409,
  unavailable: 503,
} as const satisfies Record<DealWriteError, 403 | 404 | 409 | 422 | 503>;

/**
 * Private sale deals for the people who run them. Who may read a deal is a route guard; who may
 * make which move or change which term is decided by the desk service, because it depends on the
 * deal's stage as well as the person's role. The money moves (the invoice and a refund) also need
 * a recent sign-in and an idempotency key.
 */
export function attachAdminPrivateSaleDealRoutes(
  admin: AdminHono,
  container: AdminEnquiryRoutesContainer,
  guards: AdminStaffMutationGuards,
): void {
  admin.use("/private-sales", requireDealsRead);
  admin.use("/private-sales/*", requireDealsRead);

  /** GET /admin/private-sales — one page of a view, with the count of every view. */
  admin.get("/private-sales", zValidator("query", adminDealListQuerySchema), async (c) => {
    const data = await container.admin.privateSaleDeals.list(viewerOf(c), c.req.valid("query"));
    return c.json({ data });
  });

  /** GET /admin/private-sales/:ref — the deal, its parties and checks, money, timeline and moves. */
  admin.get("/private-sales/:ref", zValidator("param", privateSaleRefParamSchema), async (c) => {
    const data = await container.admin.privateSaleDeals.detail(
      viewerOf(c),
      c.req.valid("param").ref,
    );
    if (!data) return c.json({ error: "deal_not_found" }, 404);
    return c.json({ data });
  });

  /** PATCH /admin/private-sales/:ref — change terms, against the version the person was looking at. */
  admin.patch(
    "/private-sales/:ref",
    zValidator("param", privateSaleRefParamSchema),
    zValidator("json", adminDealTermsPatchSchema),
    async (c) => {
      const result = await container.admin.privateSaleDeals.updateTerms(
        viewerOf(c),
        c.req.valid("param").ref,
        c.req.valid("json"),
      );
      return respond(c, result);
    },
  );

  /** PUT /admin/private-sales/:ref/buyer — name the person who acts for the buyer. */
  admin.put(
    "/private-sales/:ref/buyer",
    zValidator("param", privateSaleRefParamSchema),
    zValidator("json", adminDealBuyerSchema),
    async (c) => {
      const result = await container.admin.privateSaleDeals.nameBuyer(
        viewerOf(c),
        c.req.valid("param").ref,
        c.req.valid("json"),
      );
      return respond(c, result);
    },
  );

  // Moving money needs a recent sign-in and a key that makes a retry safe.
  for (const action of ["issue_invoice", "refund"] as const) {
    admin.use(
      `/private-sales/:ref/actions/${action}`,
      guards.requireStepUp,
      guards.idempotent(`private-sales.${action}`),
    );
  }

  /** POST /admin/private-sales/:ref/actions/:action — make one move on the deal. */
  admin.post(
    "/private-sales/:ref/actions/:action",
    zValidator("param", privateSaleActionParamSchema),
    zValidator("json", adminDealActionSchema),
    async (c) => {
      const { ref, action } = c.req.valid("param");
      const result = await container.admin.privateSaleDeals.act(
        viewerOf(c),
        ref,
        action,
        c.req.valid("json"),
      );
      return respond(c, result);
    },
  );
}

type WriteResult = Awaited<
  ReturnType<AdminEnquiryRoutesContainer["admin"]["privateSaleDeals"]["act"]>
>;

function respond(c: Context, result: WriteResult) {
  if (result.ok) return c.json({ data: result.record });
  return c.json(
    {
      error: result.error,
      ...(result.fields ? { fields: result.fields } : {}),
      ...(result.blockers ? { blockers: result.blockers } : {}),
      ...(result.currentVersion !== undefined ? { currentVersion: result.currentVersion } : {}),
    },
    WRITE_ERROR_STATUS[result.error],
  );
}
