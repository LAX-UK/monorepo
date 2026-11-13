import {
  PLATFORM_ADMIN_ACCESS,
  type StaffRoles,
  normalizeUserRoleOrClient,
  userHasAccessTo,
} from "@auction/types";
import { lotIdOnlyParamSchema, recordSignedAgreementBodySchema } from "@auction/validators";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { ContainerSellerProceedsRoutesSlice } from "../container/container-slices.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requirePayoutRead,
  requireSellerAgreementRecord,
  requireSellerProceedsRead,
} from "../middleware/require-capability.js";
import { createRequireRecentStaffAuth } from "../middleware/require-recent-staff-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { oldRuleReviewRow } from "../services/seller-proceeds/old-rule-review.js";
import { SellerProceedsError } from "../services/seller-proceeds/seller-proceeds-errors.js";

const payoutIdParamSchema = z.object({ payoutId: z.string().uuid() });
const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Runs one step and answers with its data, or with the refusal's code, words and field errors. */
async function respond<T>(c: Context, step: () => Promise<T>) {
  try {
    return c.json({ data: await step() });
  } catch (error) {
    if (error instanceof SellerProceedsError) {
      return c.json({ error: error.message, code: error.code, fields: error.fields }, error.status);
    }
    throw error;
  }
}

/**
 * `/admin/seller-proceeds`: the seller's side of a sold lot for staff, read from the sale's
 * snapshot and payout as stored, and recording a seller's signed paper agreement so a held sale
 * can be paid. Open to platform staff who can see the lot and to finance, who pay it out (finance
 * is outside the platform shell, so these live beside `/admin/payouts`). Recording is a step-up
 * action; replacing an agreement on record is Administrator only, checked again by the service.
 */
export function createAdminSellerProceedsRoutes(
  container: ContainerSellerProceedsRoutesSlice,
  authenticator: IAuthenticator,
) {
  const { sellerProceeds, userSuspensionChecker, admin } = container;
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => userSuspensionChecker.isSuspended(id),
  });
  const requireStepUp = createRequireRecentStaffAuth(admin.stepUp);
  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRoles?: StaffRoles;
      identitySessionId?: string;
    };
  }>();

  /** GET /admin/seller-proceeds/lots/:lotId */
  r.get(
    "/lots/:lotId",
    requireAuth,
    requireSellerProceedsRead,
    zValidator("param", lotIdOnlyParamSchema),
    async (c) => {
      const facts = await sellerProceeds.reader.forLot(c.req.valid("param").lotId);
      if (!facts)
        return c.json({ error: "This lot no longer exists.", code: "lot_not_found" }, 404);
      return c.json({ data: facts });
    },
  );

  /** POST /admin/seller-proceeds/lots/:lotId/signed-agreement */
  r.post(
    "/lots/:lotId/signed-agreement",
    requireAuth,
    requireSellerAgreementRecord,
    requireStepUp,
    zValidator("param", lotIdOnlyParamSchema),
    zValidator("json", recordSignedAgreementBodySchema),
    (c) => {
      const body = c.req.valid("json");
      const role = normalizeUserRoleOrClient(c.get("userRole"));
      return respond(c, () =>
        sellerProceeds.recordAgreement.record({
          lotId: c.req.valid("param").lotId,
          commissionPercent: body.commissionPercent,
          signedOn: body.signedOn,
          uploadObjectId: body.uploadObjectId,
          reason: body.reason,
          replace: body.replace,
          actor: {
            userId: c.get("userId") as string,
            isAdministrator: userHasAccessTo(role, c.get("userStaffRoles"), PLATFORM_ADMIN_ACCESS),
          },
        }),
      );
    },
  );

  /** GET /admin/seller-proceeds/payouts/:payoutId: each sale on the payout, and those held. */
  r.get(
    "/payouts/:payoutId",
    requireAuth,
    requirePayoutRead,
    zValidator("param", payoutIdParamSchema),
    async (c) => {
      const found = await sellerProceeds.payoutSales.forPayout(c.req.valid("param").payoutId);
      if (!found) return c.json({ error: "This payout no longer exists.", code: "not_found" }, 404);
      return c.json({ data: found });
    },
  );

  /** GET /admin/seller-proceeds/held-sales: every paid sale waiting on a missing fact. */
  r.get("/held-sales", requireAuth, requirePayoutRead, async (c) => {
    return c.json({ data: await sellerProceeds.payoutSales.heldSales(500) });
  });

  /**
   * GET /admin/seller-proceeds/old-rule: sales paid before payouts followed the signed agreement,
   * each beside what the agreement gives. Read only.
   */
  r.get(
    "/old-rule",
    requireAuth,
    requirePayoutRead,
    zValidator("query", pageQuerySchema),
    async (c) => {
      const page = c.req.valid("query");
      const [{ rows, total }, vat] = await Promise.all([
        sellerProceeds.payoutSales.oldRuleSales(page),
        sellerProceeds.vatSetting.read(),
      ]);
      return c.json({
        data: rows.map((row) => oldRuleReviewRow(row, vat)),
        meta: { total, limit: page.limit, offset: page.offset },
      });
    },
  );

  return r;
}
