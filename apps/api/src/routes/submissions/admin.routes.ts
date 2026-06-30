import type { ItemSubmissionStatus } from "@auction/types";
import {
  adminAssignSubmissionBodySchema,
  adminBulkSubmissionsBodySchema,
  approveSubmissionBodySchema,
  listSubmissionsQuerySchema,
  rejectSubmissionBodySchema,
  submissionIdParamSchema,
} from "@auction/validators";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requirePlatformShell } from "../../middleware/require-capability.js";
import type { ListSubmissionsFilter } from "../../services/interfaces/repositories.js";
import type { SubmissionHono, SubmissionRouteDeps } from "./_shared.js";

function submissionsAdminListFilter(
  q: {
    queue?: "awaiting" | "accepted" | "rejected" | undefined;
    status?: ItemSubmissionStatus | undefined;
    sellerId?: string | undefined;
    categoryId?: string | undefined;
    q?: string | undefined;
    qualityGaps?: "1" | undefined;
    assignedTo?: "me" | undefined;
    sort?: "newest" | "oldest" | "sla" | undefined;
    limit: number;
    offset: number;
  },
  userId: string,
): ListSubmissionsFilter {
  const base: ListSubmissionsFilter = {
    limit: q.limit,
    offset: q.offset,
    ...(q.sellerId ? { legalEntityId: q.sellerId } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.q ? { q: q.q.trim() || undefined } : {}),
    ...(q.qualityGaps === "1" ? { qualityGaps: true } : {}),
    ...(q.assignedTo === "me" ? { assignedToUserId: userId } : {}),
    ...(q.sort ? { sort: q.sort } : {}),
  };
  const AWAITING: ItemSubmissionStatus[] = ["submitted", "under_review"];
  const ACCEPTED: ItemSubmissionStatus[] = ["approved", "converted"];
  switch (q.queue) {
    case "awaiting":
      return { ...base, statuses: AWAITING };
    case "accepted":
      return { ...base, statuses: ACCEPTED };
    case "rejected":
      return { ...base, statuses: ["rejected"] };
    default:
      return { ...base, ...(q.status !== undefined ? { status: q.status } : {}) };
  }
}

export function attachSubmissionAdminRoutes(r: SubmissionHono, deps: SubmissionRouteDeps): void {
  const { container, requireAuth } = deps;

  r.get(
    "/",
    requireAuth,
    requirePlatformShell,
    zValidator("query", listSubmissionsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const userId = c.get("userId") as string;
      const { data, total } = await container.itemSubmissionService.listSubmissionsForAdminApi(
        submissionsAdminListFilter(q, userId),
      );
      return c.json({ data, total });
    },
  );

  r.post(
    "/:id/review/start",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const result = await container.itemSubmissionService.startReviewForAdminApi(adminId, id);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/bulk",
    requireAuth,
    requirePlatformShell,
    zValidator("json", adminBulkSubmissionsBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { ids, op, reason, reviewNotes } = c.req.valid("json");
      const out = await container.itemSubmissionService.bulkApproveOrReject({
        adminId,
        ids,
        op,
        reason,
        reviewNotes,
      });
      if (out.kind === "bad_request") {
        return c.json({ error: out.message }, 400);
      }
      if (out.kind === "err") {
        return c.json({ error: out.error.message }, asHttpStatus(out.error.status));
      }
      return c.json({ ok: true, data: { count: out.count } });
    },
  );

  r.post(
    "/:id/accept",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.itemSubmissionService.acceptForAdminApi(adminId, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/:id/convert",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.itemSubmissionService.convertForAdminApi(adminId, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/:id/assign",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", adminAssignSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { assignedToUserId } = c.req.valid("json");
      const result = await container.itemSubmissionService.assignForAdminApi(
        adminId,
        id,
        assignedToUserId,
      );
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/:id/approve",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.itemSubmissionService.approveForAdminApi(adminId, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );

  r.post(
    "/:id/reject",
    requireAuth,
    requirePlatformShell,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", rejectSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { rejectionReason, reviewNotes } = c.req.valid("json");
      const result = await container.itemSubmissionService.rejectForAdminApi(
        adminId,
        id,
        rejectionReason,
        reviewNotes,
      );
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: result.value });
    },
  );
}
