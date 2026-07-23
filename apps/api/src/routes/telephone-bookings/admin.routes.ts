import {
  adminSaleroomSaleIdParamSchema,
  adminTelephoneBookingAssignClerkBodySchema,
  adminTelephoneBookingCompleteLineBodySchema,
  adminTelephoneBookingNotesBodySchema,
  adminTelephoneBookingStartLineBodySchema,
  saleTelephoneBookingListQuerySchema,
  telephoneBookingCancelBodySchema,
} from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import type { ContainerAdminTelephoneBookingRoutesSlice } from "../../container.js";
import { respondBiddingRouteOutcome } from "../../lib/bidding-route-response.js";
import { zValidator } from "../../lib/z-validator.js";

const adminSaleBookingParamsSchema = z.object({
  saleId: z.string().uuid(),
  bookingId: z.string().uuid(),
});

export function createAdminTelephoneBookingRoutes(
  container: ContainerAdminTelephoneBookingRoutesSlice,
) {
  const telephoneBookings = container.admin.telephoneBookings;
  const r = new Hono<{ Variables: { userId?: string } }>();

  r.get("/telephone-bookings/pending-count", async (c) => {
    const { count } = await telephoneBookings.countGlobalPending();
    return c.json({ data: { count } });
  });

  r.get(
    "/sales/:saleId/telephone-bookings",
    zValidator("param", adminSaleroomSaleIdParamSchema),
    zValidator("query", saleTelephoneBookingListQuerySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const query = c.req.valid("query");
      const { items } = await telephoneBookings.listForSaleAdmin({
        saleId,
        ...(query.status !== undefined ? { status: query.status } : {}),
      });
      return c.json({ data: { items } });
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/confirm",
    zValidator("param", adminSaleBookingParamsSchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const outcome = await telephoneBookings.confirm({ saleId, bookingId, staffUserId });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/assign-clerk",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", adminTelephoneBookingAssignClerkBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookings.assignClerk({
        saleId,
        bookingId,
        staffUserId,
        clerkUserId: body.clerkUserId,
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/approve-limit-increase",
    zValidator("param", adminSaleBookingParamsSchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const outcome = await telephoneBookings.approveLimitIncrease({
        saleId,
        bookingId,
        staffUserId,
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/start-line",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", adminTelephoneBookingStartLineBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookings.startLine({
        saleId,
        bookingId,
        staffUserId,
        lotId: body.lotId,
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/complete-line",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", adminTelephoneBookingCompleteLineBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookings.completeLine({
        saleId,
        bookingId,
        staffUserId,
        lotId: body.lotId,
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/close",
    zValidator("param", adminSaleBookingParamsSchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const outcome = await telephoneBookings.closeBooking({
        saleId,
        bookingId,
        staffUserId,
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/cancel",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", telephoneBookingCancelBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookings.cancelByStaff({
        saleId,
        bookingId,
        staffUserId,
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  r.patch(
    "/sales/:saleId/telephone-bookings/:bookingId/notes",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", adminTelephoneBookingNotesBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await telephoneBookings.updateNotes({
        saleId,
        bookingId,
        staffUserId,
        notes: body.notes,
      });
      return respondBiddingRouteOutcome(c, outcome);
    },
  );

  return r;
}
