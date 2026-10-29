import {
  consignmentMoveBodySchema,
  relistReserveFloorBodySchema,
  submissionIdParamSchema,
  unsoldLotChoiceDecisionBodySchema,
  unsoldLotChoiceRequestBodySchema,
  unsoldOutcomesQuerySchema,
} from "@auction/validators";
import { respondSubmissionHttpJson } from "../../lib/submission-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireBuyerRole } from "../../middleware/require-buyer-role.js";
import { requireSubmissionsAccess } from "../../middleware/require-capability.js";
import {
  type SubmissionHono,
  type SubmissionRouteDeps,
  agreementSellerFromContext,
  viewerFromContext,
} from "./_shared.js";

/**
 * A consignment after it was handed in. Sellers read what they can do, choose what happens to
 * an unsold lot and withdraw; staff confirm those choices, move a personal consignment to an
 * organisation and remind a seller to verify. Seller writes need a client who may bid; the
 * capability matrix then decides, and refuses every write for an impersonating admin.
 */
export function attachSubmissionAfterSaleRoutes(
  r: SubmissionHono,
  deps: SubmissionRouteDeps,
): void {
  const { container, requireAuth, requireSubmissionEntityContext } = deps;
  const http = container.submissionRoutes.afterSaleHttp;

  // The account's lots that ended unsold, with what was chosen, so Home can list only those
  // still waiting for a choice in one read.
  r.get(
    "/mine/unsold-lots",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("query", unsoldOutcomesQuerySchema),
    async (c) => {
      return respondSubmissionHttpJson(
        c,
        await http.listUnsoldOutcomes(agreementSellerFromContext(c), c.req.valid("query")),
      );
    },
  );

  r.get(
    "/:id/after-sale",
    requireAuth,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return respondSubmissionHttpJson(
        c,
        await http.getForSeller(id, agreementSellerFromContext(c)),
      );
    },
  );

  r.post(
    "/:id/unsold-choice",
    requireAuth,
    requireBuyerRole,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", unsoldLotChoiceRequestBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      return respondSubmissionHttpJson(
        c,
        await http.requestUnsoldChoice(id, agreementSellerFromContext(c), body),
      );
    },
  );

  r.post(
    "/:id/withdrawal",
    requireAuth,
    requireBuyerRole,
    requireSubmissionEntityContext,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return respondSubmissionHttpJson(c, await http.withdraw(id, agreementSellerFromContext(c)));
    },
  );

  r.get(
    "/:id/after-sale/staff",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return respondSubmissionHttpJson(c, await http.getForStaff(id, viewerFromContext(c)));
    },
  );

  r.post(
    "/:id/unsold-choice/decision",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", unsoldLotChoiceDecisionBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      return respondSubmissionHttpJson(
        c,
        await http.decideUnsoldChoice(id, body, viewerFromContext(c)),
      );
    },
  );

  r.post(
    "/:id/relist-floor",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", relistReserveFloorBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { floor } = c.req.valid("json");
      return respondSubmissionHttpJson(
        c,
        await http.setRelistReserveFloor(id, floor, viewerFromContext(c)),
      );
    },
  );

  r.get(
    "/:id/move-options",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return respondSubmissionHttpJson(c, await http.moveOptions(id, viewerFromContext(c)));
    },
  );

  r.post(
    "/:id/move",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", consignmentMoveBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { legalEntityId } = c.req.valid("json");
      return respondSubmissionHttpJson(c, await http.move(id, legalEntityId, viewerFromContext(c)));
    },
  );

  r.post(
    "/:id/identity-reminder",
    requireAuth,
    requireSubmissionsAccess,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return respondSubmissionHttpJson(c, await http.remindSeller(id, viewerFromContext(c)));
    },
  );
}
