import {
  bookCollectionBodySchema,
  cancelCollectionBodySchema,
  changeCollectionBodySchema,
  collectionAvailabilityQuerySchema,
  collectionBookingIdParamSchema,
} from "@auction/validators";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import type { Result } from "neverthrow";
import type { ContainerOrganisationBuyingRoutesSlice } from "../container.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { CollectionVisitError } from "../services/collection-visits/collection-visit.errors.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { OrganisationMemberActor } from "../services/interfaces/organisation-membership-service.js";

type Variables = { userId?: string; legalEntityContext?: LegalEntityContext };
type VisitContext = Context<{ Variables: Variables }>;

const REPLAYED_HEADER = "Idempotent-Replayed";

function memberActor(c: VisitContext): OrganisationMemberActor {
  const ctx = c.get("legalEntityContext") as LegalEntityContext;
  return {
    userId: ctx.userId,
    legalEntityId: ctx.legalEntityId,
    role: ctx.role,
    isImpersonation: ctx.isImpersonation,
  };
}

function failure(c: VisitContext, e: CollectionVisitError) {
  return c.json(
    {
      error: e.code,
      message: e.message,
      ...(e.lotId ? { lotId: e.lotId } : {}),
      ...(e.reason ? { reason: e.reason } : {}),
      ...(e.issues ? { issues: e.issues } : {}),
      ...(e.bookingEmail !== undefined ? { bookingEmail: e.bookingEmail } : {}),
    },
    e.status,
  );
}

function respond<T>(c: VisitContext, result: Result<T, CollectionVisitError>) {
  return result.match(
    (data) => c.json({ data }),
    (e) => failure(c, e),
  );
}

/**
 * The acting account's collection visits: finding times, booking, changing, cancelling and reading
 * them, and the calendar file. Mounted under `/legal-entities`; the account comes from the context
 * header. Everything is for a buyer account (staff book through the desk), nothing is cached, and
 * the writes need the account's onboarding finished. Who may book which lot, the cut-off and the
 * viewing-as-the-account rule are the services' and the domain's, not decided here.
 */
export function createOrganisationCollectionVisitRoutes(
  container: ContainerOrganisationBuyingRoutesSlice,
  authenticator: IAuthenticator,
  requireAccountOnboarding: MiddlewareHandler,
  limitWrites: MiddlewareHandler,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireContext = container.requireLegalEntityContext;
  const { collectionVisits } = container.organisationBuying;
  const r = new Hono<{ Variables: Variables }>();

  r.get(
    "/collection/availability",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("query", collectionAvailabilityQuerySchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return respond(c, await collectionVisits.availability(memberActor(c), c.req.valid("query")));
    },
  );

  r.get("/collection/bookings", requireAuth, requireBuyerRole, requireContext, async (c) => {
    c.header("Cache-Control", "no-store");
    return respond(c, await collectionVisits.list(memberActor(c)));
  });

  r.post(
    "/collection/bookings",
    requireAuth,
    requireAccountOnboarding,
    requireBuyerRole,
    requireContext,
    limitWrites,
    zValidator("json", bookCollectionBodySchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      const result = await collectionVisits.book(memberActor(c), c.req.valid("json"));
      if (result.isErr()) return failure(c, result.error);
      const { visit, replayed } = result.value;
      if (replayed) c.header(REPLAYED_HEADER, "true");
      return c.json({ data: visit }, replayed ? 200 : 201);
    },
  );

  r.patch(
    "/collection/bookings/:bookingId",
    requireAuth,
    requireAccountOnboarding,
    requireBuyerRole,
    requireContext,
    limitWrites,
    zValidator("param", collectionBookingIdParamSchema),
    zValidator("json", changeCollectionBodySchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return respond(
        c,
        await collectionVisits.change(
          memberActor(c),
          c.req.valid("param").bookingId,
          c.req.valid("json"),
        ),
      );
    },
  );

  r.post(
    "/collection/bookings/:bookingId/cancel",
    requireAuth,
    requireBuyerRole,
    requireContext,
    limitWrites,
    zValidator("param", collectionBookingIdParamSchema),
    zValidator("json", cancelCollectionBodySchema),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return respond(
        c,
        await collectionVisits.cancel(
          memberActor(c),
          c.req.valid("param").bookingId,
          c.req.valid("json"),
        ),
      );
    },
  );

  // The calendar entry for a live visit. It names the lots and who collects, so it is never cached.
  r.get(
    "/collection/bookings/:bookingId/calendar.ics",
    requireAuth,
    requireBuyerRole,
    requireContext,
    zValidator("param", collectionBookingIdParamSchema),
    async (c) => {
      const result = await collectionVisits.calendar(
        memberActor(c),
        c.req.valid("param").bookingId,
      );
      if (result.isErr()) return failure(c, result.error);
      c.header("Content-Type", "text/calendar; charset=utf-8");
      c.header("X-Content-Type-Options", "nosniff");
      c.header("Content-Disposition", `attachment; filename="${result.value.filename}"`);
      c.header("Cache-Control", "no-store");
      return c.body(result.value.content);
    },
  );

  return r;
}
