import {
  adminConditionReportListQuerySchema,
  conditionReportRequestIdParamSchema,
  declineConditionReportRequestBodySchema,
  fulfillConditionReportRequestBodySchema,
} from "@auction/validators";
import type { Container } from "../../container.js";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireSpecialistCatalogueOrAuctionManage } from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminConditionReportsRoutes(platform: AdminHono, container: Container): void {
  platform.get(
    "/condition-report-requests",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("query", adminConditionReportListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const { items, total } = await container.admin.conditionReports.listForAdmin({
        status: q.status,
        lotId: q.lotId,
        limit: q.limit,
        offset: q.offset,
      });
      return c.json({ data: { items, total, limit: q.limit, offset: q.offset } });
    },
  );

  platform.post(
    "/condition-report-requests/:id/mark-in-progress",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("param", conditionReportRequestIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.conditionReports.markInProgress({
        id,
        actorUserId: userId,
      });
      return result.match(
        (data) => c.json({ data }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/condition-report-requests/:id/fulfill",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("param", conditionReportRequestIdParamSchema),
    zValidator("json", fulfillConditionReportRequestBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.conditionReports.fulfill({
        id,
        fulfilledByUserId: userId,
        conditionReport: body.conditionReport,
        ...(body.responseNote !== undefined ? { responseNote: body.responseNote } : {}),
        ...(body.responseAttachmentUploadId !== undefined
          ? { responseAttachmentUploadId: body.responseAttachmentUploadId }
          : {}),
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          { error: e.message, ...(e.code ? { code: e.code } : {}) },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value });
    },
  );

  platform.post(
    "/condition-report-requests/:id/decline",
    requireSpecialistCatalogueOrAuctionManage,
    zValidator("param", conditionReportRequestIdParamSchema),
    zValidator("json", declineConditionReportRequestBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.conditionReports.decline({
        id,
        fulfilledByUserId: userId,
        ...(body.responseNote !== undefined ? { responseNote: body.responseNote } : {}),
      });
      return result.match(
        () => c.json({ ok: true }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );
}
