import { type UserRole, normalizeUserRoleOrClient } from "@auction/types";
import {
  lotIdOnlyParamSchema,
  recordSellerAnswerBodySchema,
  reofferIdParamSchema,
  sendReofferBodySchema,
  startReofferBodySchema,
  withdrawReofferBodySchema,
} from "@auction/validators";
import type { Context } from "hono";
import type { ContainerReofferSlice } from "../../container/container-slices.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireAuctionManage,
  requireBuyerDefault,
  requireLotsRead,
} from "../../middleware/require-capability.js";
import type { ReofferStaffActor } from "../../services/reoffer/reoffer-actors.js";
import { ReofferError } from "../../services/reoffer/reoffer-errors.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

function staffActor(c: Context): ReofferStaffActor {
  return {
    userId: c.get("userId") as string,
    role: normalizeUserRoleOrClient(c.get("userRole")) as UserRole,
    staffRoles: c.get("userStaffRoles"),
  };
}

/** Runs one step and answers with its data, or with the refusal's code and words. */
async function respond<T>(c: Context, step: () => Promise<T>) {
  try {
    return c.json({ data: await step() });
  } catch (error) {
    if (error instanceof ReofferError) {
      return c.json({ error: error.message, code: error.code }, error.status);
    }
    throw error;
  }
}

/**
 * Staff steps of an offer to the next bidder after a buyer default. Starting, sending and
 * withdrawing need the buyer-default permission; recording the seller's answer needs
 * `auction.manage`. Each is a step-up action and carries a note or reason where the record needs one.
 */
export function attachAdminReofferRoutes(
  platform: AdminHono,
  container: ContainerReofferSlice,
  guards: AdminStaffMutationGuards,
): void {
  const { reoffer } = container;

  /** GET /admin/lots/:lotId/reoffers: every offer of the lot, with the bidder and the shortfall. */
  platform.get(
    "/lots/:lotId/reoffers",
    requireLotsRead,
    zValidator("param", lotIdOnlyParamSchema),
    (c) => respond(c, () => reoffer.reads.listForLot(c.req.valid("param").lotId)),
  );

  /** POST /admin/lots/:lotId/reoffers: offer the defaulted lot to the next bidder (RA22). */
  platform.post(
    "/lots/:lotId/reoffers",
    requireBuyerDefault,
    guards.requireStepUp,
    zValidator("param", lotIdOnlyParamSchema),
    zValidator("json", startReofferBodySchema),
    (c) =>
      respond(c, () =>
        reoffer.start.start(staffActor(c), c.req.valid("param").lotId, c.req.valid("json")),
      ),
  );

  /** POST /admin/reoffers/:reofferId/seller-answer: record what the seller told staff (RA2, RA3, RA5). */
  platform.post(
    "/reoffers/:reofferId/seller-answer",
    requireAuctionManage,
    guards.requireStepUp,
    zValidator("param", reofferIdParamSchema),
    zValidator("json", recordSellerAnswerBodySchema),
    (c) => {
      const body = c.req.valid("json");
      return respond(c, () =>
        reoffer.consent.recordForSeller(staffActor(c), c.req.valid("param").reofferId, {
          answer: body.answer,
          note: body.note,
          preferredNext: body.answer === "refused" ? (body.declinePreference ?? null) : null,
        }),
      );
    },
  );

  /** POST /admin/reoffers/:reofferId/send: send the offer once the seller has agreed (RA6, RA8, RA9). */
  platform.post(
    "/reoffers/:reofferId/send",
    requireBuyerDefault,
    guards.requireStepUp,
    zValidator("param", reofferIdParamSchema),
    zValidator("json", sendReofferBodySchema),
    (c) =>
      respond(c, () =>
        reoffer.offer.send(staffActor(c), c.req.valid("param").reofferId, {
          days: c.req.valid("json").offerDays,
        }),
      ),
  );

  /** POST /admin/reoffers/:reofferId/withdraw: take back an offer that is still open. */
  platform.post(
    "/reoffers/:reofferId/withdraw",
    requireBuyerDefault,
    guards.requireStepUp,
    zValidator("param", reofferIdParamSchema),
    zValidator("json", withdrawReofferBodySchema),
    (c) =>
      respond(c, () =>
        reoffer.offer.withdraw(staffActor(c), c.req.valid("param").reofferId, {
          reason: c.req.valid("json").note,
        }),
      ),
  );
}
