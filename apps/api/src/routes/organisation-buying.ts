import {
  accountPurchasesQuerySchema,
  paySeveralBodySchema,
  purchaseLotIdParamSchema,
  requestDeliveryQuoteSchema,
} from "@auction/validators";
import { type Context, Hono } from "hono";
import type { Result } from "neverthrow";
import type { ContainerOrganisationBuyingRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { OrganisationBuyingError } from "../services/interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../services/interfaces/organisation-membership-service.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };
type BuyingContext = Context<{ Variables: Variables }>;

function memberActor(c: BuyingContext): OrganisationMemberActor {
  const ctx = c.get("legalEntityContext") as LegalEntityContext;
  return {
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

function respond<T>(c: BuyingContext, result: Result<T, OrganisationBuyingError>) {
  return result.match(
    (data) => c.json({ data }),
    (e) => c.json({ error: e.code, message: e.message }, e.status),
  );
}

/**
 * The acting account's buying modules: the sales it is registered for, its purchases (with the
 * invoice and delivery stage of each, pay several and an export), courier quotes and collection
 * booking. Every read and step is narrowed by the member's role in the services. Mounted under
 * `/legal-entities`; the account comes from the context header.
 */
export function createOrganisationBuyingRoutes(
  container: ContainerOrganisationBuyingRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { registrations, purchases, deliveryQuotes, collection } = container.organisationBuying;
  const r = new Hono<{ Variables: Variables }>();

  r.get("/registrations", requireAuth, requireContext, async (c) =>
    respond(c, await registrations.list(memberActor(c))),
  );

  r.get(
    "/purchases",
    requireAuth,
    requireContext,
    zValidator("query", accountPurchasesQuerySchema),
    async (c) => respond(c, await purchases.list(memberActor(c), c.req.valid("query"))),
  );

  r.get("/purchases/export.csv", requireAuth, requireContext, async (c) => {
    const result = await purchases.exportCsv(memberActor(c));
    if (result.isErr())
      return c.json(
        { error: result.error.code, message: result.error.message },
        result.error.status,
      );
    const day = new Date().toISOString().slice(0, 10);
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="purchases-${day}.csv"`);
    c.header("Cache-Control", "no-store");
    return c.body(result.value);
  });

  r.post(
    "/purchases/pay-several/plan",
    requireAuth,
    requireContext,
    zValidator("json", paySeveralBodySchema),
    async (c) =>
      respond(c, await purchases.planPaySeveral(memberActor(c), c.req.valid("json").lotIds)),
  );

  r.post(
    "/purchases/:lotId/delivery-quote",
    requireAuth,
    requireContext,
    zValidator("param", purchaseLotIdParamSchema),
    zValidator("json", requestDeliveryQuoteSchema),
    async (c) =>
      respond(
        c,
        await deliveryQuotes.request(
          memberActor(c),
          c.req.valid("param").lotId,
          c.req.valid("json").destination,
        ),
      ),
  );

  r.post(
    "/purchases/:lotId/delivery-quote/accept",
    requireAuth,
    requireContext,
    zValidator("param", purchaseLotIdParamSchema),
    async (c) =>
      respond(c, await deliveryQuotes.accept(memberActor(c), c.req.valid("param").lotId)),
  );

  r.post(
    "/purchases/:lotId/delivery-quote/withdraw",
    requireAuth,
    requireContext,
    zValidator("param", purchaseLotIdParamSchema),
    async (c) =>
      respond(c, await deliveryQuotes.withdraw(memberActor(c), c.req.valid("param").lotId)),
  );

  r.get(
    "/purchases/:lotId/collection",
    requireAuth,
    requireContext,
    zValidator("param", purchaseLotIdParamSchema),
    async (c) => respond(c, await collection.offer(memberActor(c), c.req.valid("param").lotId)),
  );

  return r;
}
