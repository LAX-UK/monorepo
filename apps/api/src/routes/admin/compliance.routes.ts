import { respondComplianceRouteError } from "../../lib/compliance-route-errors.js";
import { applyStaffPreviewFramingHeaders } from "../../lib/staff-preview-framing.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireAmlReview, requireMlroDecision } from "../../middleware/require-capability.js";
import type { AdminComplianceRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import {
  amlReviewBodySchema,
  amlReviewQuerySchema,
  amlScreeningIdParamSchema,
  amlTriageBodySchema,
  sourceOfFundsDocumentIdParamSchema,
  sourceOfFundsDocumentReviewBodySchema,
  sourceOfFundsIdParamSchema,
  sourceOfFundsListQuerySchema,
  sourceOfFundsRequestDocumentsBodySchema,
  sourceOfFundsReviewBodySchema,
  sourceOfFundsTriageBodySchema,
} from "./_schemas.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminComplianceRoutes(
  platform: AdminHono,
  container: AdminComplianceRoutesContainer,
): void {
  // ── AML / sanctions watchlist review (MLRO / compliance) ──────────────────
  platform.get(
    "/compliance/aml/screenings",
    requireAmlReview,
    zValidator("query", amlReviewQuerySchema),
    async (c) => {
      const { limit, offset } = c.req.valid("query");
      const page = await container.admin.aml.getPage({ limit, offset });
      return c.json({
        data: page.rows,
        meta: {
          total: page.total,
          limit: page.limit,
          offset: page.offset,
          summary: page.summary,
        },
      });
    },
  );

  platform.get(
    "/compliance/aml/screenings/:id",
    requireAmlReview,
    zValidator("param", amlScreeningIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const row = await container.admin.aml.getPendingById(id);
      if (!row) {
        return c.json({ error: "not_found" }, 404);
      }
      return c.json({ data: row });
    },
  );

  // First-line analyst triage (maker): advisory recommendation only.
  platform.post(
    "/compliance/aml/screenings/:id/triage",
    requireAmlReview,
    zValidator("param", amlScreeningIdParamSchema),
    zValidator("json", amlTriageBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { recommendation, notes } = c.req.valid("json");
      const analystUserId = c.get("userId") as string;
      try {
        const record = await container.admin.aml.triage({
          screeningId: id,
          analystUserId,
          recommendation,
          notes: notes ?? null,
        });
        return c.json({ ok: true, screening: record });
      } catch (err) {
        const mapped = respondComplianceRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

  // MLRO decision (checker): binding clear/block. Requires a prior triage by a
  // different user (maker-checker / four-eyes).
  platform.post(
    "/compliance/aml/screenings/:id/decide",
    requireMlroDecision,
    zValidator("param", amlScreeningIdParamSchema),
    zValidator("json", amlReviewBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { decision, notes } = c.req.valid("json");
      const reviewerUserId = c.get("userId") as string;
      try {
        const record = await container.admin.aml.decide({
          screeningId: id,
          reviewerUserId,
          decision,
          notes: notes ?? null,
        });
        return c.json({ ok: true, screening: record });
      } catch (err) {
        const mapped = respondComplianceRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

  // ── Source of Funds review (MLRO / compliance / finance) ──────────────────
  platform.get(
    "/compliance/source-of-funds",
    requireAmlReview,
    zValidator("query", sourceOfFundsListQuerySchema),
    async (c) => {
      const { limit, offset, status } = c.req.valid("query");
      const page = await container.admin.sourceOfFunds.getPage({ status, limit, offset });
      return c.json({
        data: page.rows,
        meta: {
          total: page.total,
          limit: page.limit,
          offset: page.offset,
          summary: page.summary,
        },
      });
    },
  );

  platform.get(
    "/compliance/source-of-funds/:id/detail",
    requireAmlReview,
    zValidator("param", sourceOfFundsIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const detail = await container.admin.sourceOfFunds.getDetail(id);
      if (!detail) {
        return c.json({ error: "source_of_funds_not_found" }, 404);
      }
      return c.json({ data: detail });
    },
  );

  // First-line analyst triage (maker) for a SoF case.
  platform.post(
    "/compliance/source-of-funds/:id/triage",
    requireAmlReview,
    zValidator("param", sourceOfFundsIdParamSchema),
    zValidator("json", sourceOfFundsTriageBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { recommendation, notes } = c.req.valid("json");
      const analystUserId = c.get("userId") as string;
      try {
        const record = await container.admin.sourceOfFunds.triage({
          caseId: id,
          analystUserId,
          recommendation,
          notes: notes ?? null,
        });
        return c.json({ ok: true, sourceOfFunds: record });
      } catch (err) {
        const mapped = respondComplianceRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

  // MLRO/finance decision (checker): binding approve/reject. Requires a prior
  // triage by a different user.
  platform.post(
    "/compliance/source-of-funds/:id/decide",
    requireMlroDecision,
    zValidator("param", sourceOfFundsIdParamSchema),
    zValidator("json", sourceOfFundsReviewBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { decision, notes } = c.req.valid("json");
      const reviewerUserId = c.get("userId") as string;
      try {
        const record = await container.admin.sourceOfFunds.decide({
          caseId: id,
          reviewerUserId,
          decision,
          notes: notes ?? null,
        });
        return c.json({ ok: true, sourceOfFunds: record });
      } catch (err) {
        const mapped = respondComplianceRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

  platform.post(
    "/compliance/source-of-funds/:id/reopen",
    requireMlroDecision,
    zValidator("param", sourceOfFundsIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const actorUserId = c.get("userId") as string;
      try {
        const record = await container.admin.sourceOfFunds.reopenRejected({
          caseId: id,
          actorUserId,
        });
        return c.json({ ok: true, sourceOfFunds: record });
      } catch (err) {
        const mapped = respondComplianceRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

  platform.post(
    "/compliance/source-of-funds/:id/request-documents",
    requireAmlReview,
    zValidator("param", sourceOfFundsIdParamSchema),
    zValidator("json", sourceOfFundsRequestDocumentsBodySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { documentTypes, note } = c.req.valid("json");
      const staffUserId = c.get("userId") as string;
      try {
        const record = await container.admin.sourceOfFunds.requestDocuments({
          caseId: id,
          staffUserId,
          documentTypes,
          note: note ?? null,
        });
        return c.json({ ok: true, sourceOfFunds: record });
      } catch (err) {
        const mapped = respondComplianceRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );

  platform.get(
    "/compliance/source-of-funds/:id/documents/:docId/download",
    requireAmlReview,
    zValidator("param", sourceOfFundsDocumentIdParamSchema),
    async (c) => {
      const { id, docId } = c.req.valid("param");
      const staffUserId = c.get("userId") as string;
      const clientIp =
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null;
      const result = await container.admin.sourceOfFunds.getStaffDownloadUrl({
        caseId: id,
        documentId: docId,
        staffUserId,
        clientIp,
      });
      if (!result) return c.json({ error: "document_not_found" }, 404);
      return c.json({ data: result });
    },
  );

  platform.get(
    "/compliance/source-of-funds/:id/documents/download-all",
    requireAmlReview,
    zValidator("param", sourceOfFundsIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const staffUserId = c.get("userId") as string;
      const clientIp =
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null;
      const result = await container.admin.sourceOfFunds.getStaffBulkDownloadZip({
        caseId: id,
        staffUserId,
        clientIp,
      });
      if (!result) return c.json({ error: "no_documents" }, 404);
      c.header("Content-Type", "application/zip");
      c.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
      return c.body(new Uint8Array(result.buffer));
    },
  );

  platform.get(
    "/compliance/source-of-funds/:id/documents/:docId/preview",
    requireAmlReview,
    zValidator("param", sourceOfFundsDocumentIdParamSchema),
    async (c) => {
      const { id, docId } = c.req.valid("param");
      const staffUserId = c.get("userId") as string;
      const clientIp =
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null;
      const result = await container.admin.sourceOfFunds.getStaffPreviewBytes({
        caseId: id,
        documentId: docId,
        staffUserId,
        clientIp,
      });
      if (!result) return c.json({ error: "document_not_found" }, 404);
      c.header("Content-Type", result.contentType);
      c.header("X-Content-Type-Options", "nosniff");
      applyStaffPreviewFramingHeaders(c, container.admin.sourceOfFunds.staffPreviewEnv);
      c.header(
        "Content-Disposition",
        `inline; filename="${result.fileName.replace(/[^\w\s.-]/g, "_")}"`,
      );
      return c.body(new Uint8Array(result.buffer));
    },
  );

  platform.post(
    "/compliance/source-of-funds/:id/documents/:docId/review",
    requireAmlReview,
    zValidator("param", sourceOfFundsDocumentIdParamSchema),
    zValidator("json", sourceOfFundsDocumentReviewBodySchema),
    async (c) => {
      const { id, docId } = c.req.valid("param");
      const body = c.req.valid("json");
      const staffUserId = c.get("userId") as string;
      try {
        const row = await container.admin.sourceOfFunds.reviewDocument({
          caseId: id,
          documentId: docId,
          staffUserId,
          checks: {
            matchesDeclaredSource: body.checks.matchesDeclaredSource ?? false,
            coversExposure: body.checks.coversExposure ?? false,
            recentEnough: body.checks.recentEnough ?? false,
            legibleComplete: body.checks.legibleComplete ?? false,
          },
          note: body.note ?? null,
        });
        return c.json({ ok: true, data: row });
      } catch (err) {
        const mapped = respondComplianceRouteError(c, err);
        if (mapped) return mapped;
        throw err;
      }
    },
  );
}
