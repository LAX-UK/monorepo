import {
  adminSaleroomSaleIdParamSchema,
  adminSaleroomSessionBatchQuerySchema,
  displayApproveBodySchema,
  displayOverlayBodySchema,
  displayRevokeBodySchema,
  saleroomAdvanceLotBodySchema,
} from "@auction/validators";
import type { Container } from "../../container.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireAuctionManage } from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminSaleroomSessionRoutes(platform: AdminHono, container: Container): void {
  platform.get(
    "/saleroom/sessions",
    requireAuctionManage,
    zValidator("query", adminSaleroomSessionBatchQuerySchema),
    async (c) => {
      const { saleIds } = c.req.valid("query");
      const sessions = await container.admin.saleroom.getSessionStatuses(saleIds);
      return c.json({ sessions });
    },
  );

  platform.get(
    "/sales/:saleId/saleroom/session",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const data = await container.admin.saleroom.getSessionWithRecentEvents(saleId);
      return c.json({ data });
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/go-live",
    requireAuctionManage,
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
    requireAuctionManage,
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
    requireAuctionManage,
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
    requireAuctionManage,
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
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.hammerCurrentLot({
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
    "/sales/:saleId/saleroom/no-sale",
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.saleroom.noSaleCurrentLot({
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
    "/sales/:saleId/saleroom/close",
    requireAuctionManage,
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
    requireAuctionManage,
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
    requireAuctionManage,
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
    requireAuctionManage,
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
    requireAuctionManage,
    zValidator("param", adminSaleroomSaleIdParamSchema),
    async (c) => {
      const { saleId } = c.req.valid("param");
      const devices = await container.admin.display.listDevices(saleId);
      return c.json({ data: { items: devices } });
    },
  );

  platform.post(
    "/sales/:saleId/saleroom/display/revoke",
    requireAuctionManage,
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
