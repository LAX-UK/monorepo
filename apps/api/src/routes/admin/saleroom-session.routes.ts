import {
  adminSaleroomSaleIdParamSchema,
  adminSaleroomSessionBatchQuerySchema,
  buildValidationFailedBody,
  displayApproveBodySchema,
  displayOverlayBodySchema,
  displayRevokeBodySchema,
  saleroomAdvanceLotBodySchema,
  saleroomLotOutcomeBodySchema,
  saleroomLotParamSchema,
} from "@auction/validators";
import type { Context } from "hono";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireSaleroomOperate } from "../../middleware/require-capability.js";
import type { AdminOperationsSaleroomRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

/**
 * Hammer and no sale take an optional `{ lotId }`: the lot the clerk saw on the block. The body
 * may be missing altogether (a console from before lot ids were sent), which reads as no lot id.
 */
async function readLotOutcomeBody(c: Context) {
  const raw = await c.req.text();
  let json: unknown = {};
  if (raw.trim() !== "") {
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
  }
  return saleroomLotOutcomeBodySchema.safeParse(json);
}

export function attachAdminSaleroomSessionRoutes(
  platform: AdminHono,
  container: AdminOperationsSaleroomRoutesContainer,
): void {
  platform.get(
    "/saleroom/sessions",
    requireSaleroomOperate,
    zValidator("query", adminSaleroomSessionBatchQuerySchema),
    async (c) => {
      const { saleIds } = c.req.valid("query");
      const sessions = await container.admin.saleroom.getSessionStatuses(saleIds);
      return c.json({ sessions });
    },
  );

  platform.get(
    "/sales/:saleId/saleroom/session",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const data = await container.admin.saleroom.getSessionWithRecentEvents(saleId);
      return c.json({ data });
    },
  );

  platform.get(
    "/sales/:saleId/saleroom/lots/:lotId",
    requireSaleroomOperate,
    zValidator("param", saleroomLotParamSchema),
    async (c) => {
      const { saleId, lotId } = c.req.valid("param");
      const data = await container.admin.saleroom.getLotSnapshot(saleId, lotId);
      if (!data) return c.json({ error: "Lot not found in this sale", code: "not_found" }, 404);
      return c.json({ data });
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/go-live",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.goLive({ saleId, actorUserId: userId });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/pause",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.pause({ saleId, actorUserId: userId });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/resume",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.resume({ saleId, actorUserId: userId });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/advance",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    zValidator("json", saleroomAdvanceLotBodySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const { lotId } = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.advanceToLot({
        saleId,
        lotId,
        actorUserId: userId,
      });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/hammer",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const body = await readLotOutcomeBody(c);
      if (!body.success) return c.json(buildValidationFailedBody(body.error), 400);
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.hammerCurrentLot({
        saleId,
        actorUserId: userId,
        ...(body.data.lotId ? { lotId: body.data.lotId } : {}),
      });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/no-sale",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const body = await readLotOutcomeBody(c);
      if (!body.success) return c.json(buildValidationFailedBody(body.error), 400);
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.noSaleCurrentLot({
        saleId,
        actorUserId: userId,
        ...(body.data.lotId ? { lotId: body.data.lotId } : {}),
      });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/close",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.closeSession({ saleId, actorUserId: userId });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/display/approve",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    zValidator("json", displayApproveBodySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const { userCode } = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.display.approvePairing({
        userCode,
        saleId,
        actorUserId: userId,
      });
      return result.match(
        (body) => c.json({ data: body }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/display/overlay",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    zValidator("json", displayOverlayBodySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.display.setOverlay({
        saleId,
        kind: body.kind,
        ...(body.message != null ? { message: body.message } : {}),
        actorUserId: userId,
      });
      return result.match(
        (data) => c.json({ data }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.delete(
    "/sales/:saleId/saleroom/display/overlay",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.display.clearOverlay({
        saleId,
        actorUserId: userId,
      });
      return result.match(
        () => c.json({ data: { ok: true } }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.get(
    "/sales/:saleId/saleroom/display/devices",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const devices = await container.admin.display.listDevices(saleId);
      return c.json({ data: { items: devices } });
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/display/revoke",
    requireSaleroomOperate,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    zValidator("json", displayRevokeBodySchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const { pairingId } = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.display.revokePairing({
        pairingId,
        saleId,
        actorUserId: userId,
      });
      return result.match(
        () => c.json({ data: { ok: true } }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );
}
