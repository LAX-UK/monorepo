import {
  addTelephoneBookingLotsBodySchema,
  createTelephoneBookingBodySchema,
  saleIdParamSchema,
  telephoneBookingCancelBodySchema,
  telephoneBookingIdParamSchema,
  telephoneBookingLimitIncreaseBodySchema,
} from "@auction/validators";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { ContainerBuyerTelephoneBookingRoutesSlice } from "../../container.js";
import { respondBiddingRouteOutcome } from "../../lib/bidding-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import { createRequireAuth } from "../../middleware/require-auth.js";
import { requireBuyerRole } from "../../middleware/require-buyer-role.js";
import { createRequireKyc } from "../../middleware/require-kyc.js";
import type { IAuthenticator } from "../../services/interfaces/authenticator.js";

export function createBuyerTelephoneBookingRoutes(
  container: ContainerBuyerTelephoneBookingRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const kyc = container.kycService;
  const kycGate =
    kyc?.isConfigured() === true
      ? createRequireKyc(kyc)
      : createMiddleware<{ Variables: { userId?: string } }>(async (_c, next) => {
          await next();
        });

  const telephoneBookingHttp = container.bidding.telephoneBookingHttp;

  const buyer = new Hono<{ Variables: { userId?: string } }>();

  buyer.post(
    "/:id/telephone-bookings",
    requireAuth,
    requireBuyerRole,
    kycGate,
    zValidator("param", saleIdParamSchema),
    zValidator("json", createTelephoneBookingBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: saleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookingHttp.requestBooking({
        userId,
        saleId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        ...(body.lotIds !== undefined ? { lotIds: body.lotIds } : {}),
        ...(body.authorizedMax !== undefined ? { authorizedMax: body.authorizedMax } : {}),
        ...(body.buyerNotes !== undefined ? { buyerNotes: body.buyerNotes } : {}),
      });
      return respondBiddingRouteOutcome(c, outcome, 201);
    },
  );

  buyer.get(
    "/:id/telephone-bookings/mine",
    requireAuth,
    requireBuyerRole,
    zValidator("param", saleIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: saleId } = c.req.valid("param");
      const outcome = await telephoneBookingHttp.findMineForSale({ saleId, userId });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  const me = new Hono<{ Variables: { userId?: string } }>();

  me.get("/me/telephone-bookings", requireAuth, requireBuyerRole, async (c) => {
    const userId = c.get("userId") as string;
    const outcome = await telephoneBookingHttp.listMineForUser({ userId });
    return respondBiddingRouteOutcome(c, outcome);
  });

  const booking = new Hono<{ Variables: { userId?: string } }>();

  booking.get(
    "/:id",
    requireAuth,
    requireBuyerRole,
    zValidator("param", telephoneBookingIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: bookingId } = c.req.valid("param");
      const outcome = await telephoneBookingHttp.getDetailForUser({ bookingId, userId });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  booking.patch(
    "/:id/lots",
    requireAuth,
    requireBuyerRole,
    zValidator("param", telephoneBookingIdParamSchema),
    zValidator("json", addTelephoneBookingLotsBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: bookingId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookingHttp.addLotsOfInterest({
        bookingId,
        userId,
        lotIds: body.lotIds,
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  booking.post(
    "/:id/limit-increase",
    requireAuth,
    requireBuyerRole,
    zValidator("param", telephoneBookingIdParamSchema),
    zValidator("json", telephoneBookingLimitIncreaseBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: bookingId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookingHttp.requestLimitIncrease({
        bookingId,
        userId,
        amount: body.amount,
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  booking.post(
    "/:id/cancel",
    requireAuth,
    requireBuyerRole,
    zValidator("param", telephoneBookingIdParamSchema),
    zValidator("json", telephoneBookingCancelBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: bookingId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookingHttp.cancelByBuyer({
        bookingId,
        userId,
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  const root = new Hono();
  root.route("/sales", buyer);
  root.route("/users", me);
  root.route("/telephone-bookings", booking);
  return root;
}
