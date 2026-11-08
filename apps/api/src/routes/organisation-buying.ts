import {
  accountPurchasesQuerySchema,
  payPlanQuerySchema,
  paySeveralBodySchema,
  paySeveralStartBodySchema,
  purchaseLotIdParamSchema,
  reportPurchaseProblemSchema,
  requestDeliveryQuoteSchema,
} from "@auction/validators";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import type { Result } from "neverthrow";
import type { ContainerOrganisationBuyingRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
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
    (e) =>
      c.json(
        { error: e.code, message: e.message, ...(e.quote ? { plan: e.quote } : {}) },
        e.status,
      ),
  );
}

/**
 * The acting account's buying modules: the sales it is registered for, its purchases (with the
 * invoice and delivery stage of each, paying several at once and an export), courier quotes, collection
 * booking and reporting a problem with a paid purchase. Every read and step is narrowed by the member's role in the services. Mounted under
 * `/legal-entities`; the account comes from the context header.
 */
export function createOrganisationBuyingRoutes(
  container: ContainerOrganisationBuyingRoutesSlice,
  authenticator: IAuthenticator,
  requireAccountOnboarding: MiddlewareHandler,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const {
    registrations,
    purchases,
    payPlan,
    paySeveral,
    payTransfer,
    invoicePdf,
    payProgress,
    deliveryQuotes,
    collection,
    problems,
  } = container.organisationBuying;
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

  // What one payment of the picked lots covers, and whether Pay is offered. Only reads. Signed in
  // and not suspended, a buyer account (staff never pay) and the acting account; whether the
  // account finished onboarding is reported as a gate so the page can show where it stands.
  r.get(
    "/purchases/pay-plan",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("query", payPlanQuerySchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return respond(c, await payPlan.plan(memberActor(c), c.req.valid("query").lots));
    },
  );

  // Where a payment under way for the picked lots stands: a light read for a page that waits.
  r.get(
    "/purchases/pay-progress",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("query", payPlanQuerySchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return respond(c, await payProgress.progress(memberActor(c), c.req.valid("query").lots));
    },
  );

  // The account details and reference of a bank transfer already chosen for the picked lots.
  // Only reads; shown to the members who pay for the account, never cached.
  r.get(
    "/purchases/pay-transfer",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("query", payPlanQuerySchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return respond(c, await payTransfer.instructions(memberActor(c), c.req.valid("query").lots));
    },
  );

  // Paying several invoices passes the same gates as paying one (`POST /payments`): signed in
  // and not suspended, onboarding complete, and a buyer account (staff accounts never pay).
  r.post(
    "/purchases/pay-several/plan",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("json", paySeveralBodySchema),
    async (c) => respond(c, await paySeveral.plan(memberActor(c), c.req.valid("json").lotIds)),
  );

  // One payment for several invoices: holds them together and opens the checkout for the total.
  r.post(
    "/purchases/pay-several",
    requireAuth,
    requireAccountOnboarding,
    requireBuyerRole,
    requireContext,
    zValidator("json", paySeveralStartBodySchema),
    async (c) => respond(c, await paySeveral.pay(memberActor(c), c.req.valid("json"))),
  );

  // The invoice of a won lot as a PDF, for the member who pays it. Never cached: it carries the
  // account's name and the lot's figures.
  r.get(
    "/purchases/:lotId/invoice.pdf",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("param", purchaseLotIdParamSchema),
    async (c) => {
      const result = await invoicePdf.render(memberActor(c), c.req.valid("param").lotId);
      if (result.isErr()) {
        const e = result.error;
        return c.json({ error: e.code, message: e.message }, e.status);
      }
      c.header("Content-Type", "application/pdf");
      c.header("Content-Disposition", `attachment; filename="${result.value.filename}"`);
      c.header("Cache-Control", "no-store");
      return c.body(new Uint8Array(result.value.pdf));
    },
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

  // The buyer's report of a problem with a paid purchase; repeating it returns the open one.
  r.get(
    "/purchases/:lotId/problem",
    requireAuth,
    requireContext,
    zValidator("param", purchaseLotIdParamSchema),
    async (c) => respond(c, await problems.current(memberActor(c), c.req.valid("param").lotId)),
  );

  r.post(
    "/purchases/:lotId/problem",
    requireAuth,
    requireContext,
    zValidator("param", purchaseLotIdParamSchema),
    zValidator("json", reportPurchaseProblemSchema),
    async (c) =>
      respond(
        c,
        await problems.report(memberActor(c), c.req.valid("param").lotId, c.req.valid("json")),
      ),
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
