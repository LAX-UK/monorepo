import {
  acceptReofferBodySchema,
  declineReofferBodySchema,
  reofferIdParamSchema,
  sellerReofferAnswerBodySchema,
} from "@auction/validators";
import { type Context, Hono } from "hono";
import type { ContainerReofferRoutesSlice } from "../container/container-slices.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { ReofferMemberActor } from "../services/reoffer/reoffer-actors.js";
import { ReofferError } from "../services/reoffer/reoffer-errors.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };
type ReofferContext = Context<{ Variables: Variables }>;

function memberActor(c: ReofferContext): ReofferMemberActor {
  const ctx = c.get("legalEntityContext") as LegalEntityContext;
  return {
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

async function respond<T>(c: ReofferContext, step: () => Promise<T>) {
  try {
    c.header("Cache-Control", "no-store");
    return c.json({ data: await step() });
  } catch (error) {
    if (error instanceof ReofferError) {
      return c.json({ error: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}

/**
 * The acting account's side of an offer to the next bidder. As the offered bidder: see the offer
 * and accept or decline it. As the seller: see the request and answer it. The two sides never see
 * each other: separate routes, separate shapes. Accepting is a signed-in POST with the terms
 * ticked and nothing else; there is no GET that accepts, so a link in an email cannot (RA11).
 * Mounted under `/legal-entities`; the account comes from the context header.
 */
export function createOrganisationReofferRoutes(
  container: ContainerReofferRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { reads, response, consent } = container.reoffer;
  const r = new Hono<{ Variables: Variables }>();

  // The bidder's side: a buyer account (staff never buy) acting for the offered account.
  r.get("/reoffers", requireAuth, requireBuyerRole, requireContext, (c) =>
    respond(c, () => reads.listForBidder(memberActor(c))),
  );

  r.get(
    "/reoffers/:reofferId",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("param", reofferIdParamSchema),
    (c) => respond(c, () => reads.getForBidder(memberActor(c), c.req.valid("param").reofferId)),
  );

  r.post(
    "/reoffers/:reofferId/accept",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("param", reofferIdParamSchema),
    zValidator("json", acceptReofferBodySchema),
    (c) =>
      respond(c, () =>
        response.accept(memberActor(c), c.req.valid("param").reofferId, {
          termsAccepted: c.req.valid("json").termsAccepted,
        }),
      ),
  );

  r.post(
    "/reoffers/:reofferId/decline",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("param", reofferIdParamSchema),
    zValidator("json", declineReofferBodySchema),
    (c) =>
      respond(c, () =>
        response.decline(memberActor(c), c.req.valid("param").reofferId, c.req.valid("json")),
      ),
  );

  // The seller's side: the requests made to the acting account.
  r.get("/reoffer-requests", requireAuth, requireContext, (c) =>
    respond(c, () => reads.listForSeller(memberActor(c))),
  );

  r.get(
    "/reoffer-requests/:reofferId",
    requireAuth,
    requireContext,
    zValidator("param", reofferIdParamSchema),
    (c) => respond(c, () => reads.getForSeller(memberActor(c), c.req.valid("param").reofferId)),
  );

  r.post(
    "/reoffer-requests/:reofferId/answer",
    requireAuth,
    requireContext,
    zValidator("param", reofferIdParamSchema),
    zValidator("json", sellerReofferAnswerBodySchema),
    (c) => {
      const body = c.req.valid("json");
      return respond(c, () =>
        consent.answerInWorkspace(memberActor(c), c.req.valid("param").reofferId, {
          answer: body.answer,
          preferredNext: body.answer === "refused" ? body.declinePreference : null,
        }),
      );
    },
  );

  return r;
}
