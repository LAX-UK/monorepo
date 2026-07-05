import {
  addTelephoneBookingLotsBodySchema,
  adminSaleroomSaleIdParamSchema,
  adminTelephoneBookingAssignClerkBodySchema,
  adminTelephoneBookingCompleteLineBodySchema,
  adminTelephoneBookingNotesBodySchema,
  adminTelephoneBookingStartLineBodySchema,
  createTelephoneBookingBodySchema,
  saleIdParamSchema,
  saleTelephoneBookingListQuerySchema,
  telephoneBookingCancelBodySchema,
  telephoneBookingIdParamSchema,
  telephoneBookingLimitIncreaseBodySchema,
} from "@auction/validators";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { ContainerTelephoneBookingRoutesSlice } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import { createRequireKyc } from "../middleware/require-kyc.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const adminSaleBookingParamsSchema = z.object({
  saleId: z.string().uuid(),
  bookingId: z.string().uuid(),
});

function serviceError(
  c: { json: (body: unknown, status?: number) => Response },
  e: {
    message: string;
    status: number;
    code?: string;
  },
) {
  return c.json(
    e.code ? { error: e.message, code: e.code } : { error: e.message },
    asHttpStatus(e.status),
  );
}

async function requireBookingForSale(
  container: ContainerTelephoneBookingRoutesSlice,
  c: { json: (body: unknown, status?: number) => Response },
  saleId: string,
  bookingId: string,
) {
  const check = await container.telephoneBidBookingService.assertBookingBelongsToSale(
    bookingId,
    saleId,
  );
  if (check.isErr()) {
    return { ok: false as const, response: serviceError(c, check.error) };
  }
  return { ok: true as const, booking: check.value };
}

export function createTelephoneBookingRoutes(
  container: ContainerTelephoneBookingRoutesSlice,
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
      const result = await container.telephoneBidBookingService.requestBooking({
        userId,
        saleId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        ...(body.lotIds !== undefined ? { lotIds: body.lotIds } : {}),
        ...(body.authorizedMax !== undefined ? { authorizedMax: body.authorizedMax } : {}),
        ...(body.buyerNotes !== undefined ? { buyerNotes: body.buyerNotes } : {}),
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value }, 201);
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
      const booking = await container.telephoneBidBookingService.findMineForSale(saleId, userId);
      return c.json({ data: booking });
    },
  );

  const me = new Hono<{ Variables: { userId?: string } }>();

  me.get("/me/telephone-bookings", requireAuth, requireBuyerRole, async (c) => {
    const userId = c.get("userId") as string;
    const items = await container.telephoneBidBookingService.listMineForUser(userId);
    return c.json({ data: { items } });
  });

  const booking = new Hono<{ Variables: { userId?: string } }>();

  booking.get(
    "/:id",
    requireAuth,
    requireBuyerRole,
    zValidator("param", telephoneBookingIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const result = await container.telephoneBidBookingService.getDetailForUser(id, userId);
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
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
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.telephoneBidBookingService.addLotsOfInterest({
        bookingId: id,
        userId,
        lotIds: body.lotIds,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
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
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.telephoneBidBookingService.requestLimitIncrease({
        bookingId: id,
        userId,
        amount: body.amount,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
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
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.telephoneBidBookingService.cancelByBuyer({
        bookingId: id,
        userId,
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  const root = new Hono();
  root.route("/sales", buyer);
  root.route("/users", me);
  root.route("/telephone-bookings", booking);
  return root;
}

export function createAdminTelephoneBookingRoutes(container: ContainerTelephoneBookingRoutesSlice) {
  const r = new Hono<{ Variables: { userId?: string } }>();

  r.get("/telephone-bookings/pending-count", async (c) => {
    const count = await container.telephoneBidBookingService.countGlobalPending();
    return c.json({ data: { count } });
  });

  r.get(
    "/sales/:saleId/telephone-bookings",
    zValidator("param", adminSaleroomSaleIdParamSchema),
    zValidator("query", saleTelephoneBookingListQuerySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const query = c.req.valid("query");
      const items = await container.telephoneBidBookingService.listForSaleAdmin(
        saleId,
        query.status,
      );
      return c.json({ data: { items } });
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/confirm",
    zValidator("param", adminSaleBookingParamsSchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const scoped = await requireBookingForSale(container, c, saleId, bookingId);
      if (!scoped.ok) return scoped.response;
      const result = await container.telephoneBidBookingService.confirm({
        bookingId,
        staffUserId,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/assign-clerk",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", adminTelephoneBookingAssignClerkBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const scoped = await requireBookingForSale(container, c, saleId, bookingId);
      if (!scoped.ok) return scoped.response;
      const body = c.req.valid("json");
      const result = await container.telephoneBidBookingService.assignClerk({
        bookingId,
        staffUserId,
        clerkUserId: body.clerkUserId,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/approve-limit-increase",
    zValidator("param", adminSaleBookingParamsSchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const scoped = await requireBookingForSale(container, c, saleId, bookingId);
      if (!scoped.ok) return scoped.response;
      const result = await container.telephoneBidBookingService.approveLimitIncrease({
        bookingId,
        staffUserId,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/start-line",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", adminTelephoneBookingStartLineBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const scoped = await requireBookingForSale(container, c, saleId, bookingId);
      if (!scoped.ok) return scoped.response;
      const body = c.req.valid("json");
      const result = await container.telephoneBidBookingService.startLine({
        bookingId,
        staffUserId,
        lotId: body.lotId,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/complete-line",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", adminTelephoneBookingCompleteLineBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const scoped = await requireBookingForSale(container, c, saleId, bookingId);
      if (!scoped.ok) return scoped.response;
      const body = c.req.valid("json");
      const result = await container.telephoneBidBookingService.completeLine({
        bookingId,
        staffUserId,
        lotId: body.lotId,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/close",
    zValidator("param", adminSaleBookingParamsSchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const scoped = await requireBookingForSale(container, c, saleId, bookingId);
      if (!scoped.ok) return scoped.response;
      const result = await container.telephoneBidBookingService.closeBooking({
        bookingId,
        staffUserId,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/sales/:saleId/telephone-bookings/:bookingId/cancel",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", telephoneBookingCancelBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const scoped = await requireBookingForSale(container, c, saleId, bookingId);
      if (!scoped.ok) return scoped.response;
      const body = c.req.valid("json");
      const result = await container.telephoneBidBookingService.cancelByStaff({
        bookingId,
        staffUserId,
        ...(body.reason !== undefined ? { reason: body.reason } : {}),
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  r.patch(
    "/sales/:saleId/telephone-bookings/:bookingId/notes",
    zValidator("param", adminSaleBookingParamsSchema),
    zValidator("json", adminTelephoneBookingNotesBodySchema),
    async (c) => {
      const staffUserId = c.get("userId") as string;
      const { saleId, bookingId } = c.req.valid("param");
      const scoped = await requireBookingForSale(container, c, saleId, bookingId);
      if (!scoped.ok) return scoped.response;
      const body = c.req.valid("json");
      const result = await container.telephoneBidBookingService.updateNotes({
        bookingId,
        staffUserId,
        notes: body.notes,
      });
      if (result.isErr()) return serviceError(c, result.error);
      return c.json({ data: result.value });
    },
  );

  return r;
}
