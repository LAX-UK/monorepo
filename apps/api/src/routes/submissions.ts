import type { UpdateItemSubmissionInput } from "@auction/types";
import {
  adminSubmissionNotesSchema,
  approveSubmissionBodySchema,
  createItemSubmissionSchema,
  listSubmissionsQuerySchema,
  rejectSubmissionBodySchema,
  submissionIdParamSchema,
  updateItemSubmissionSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createSubmissionRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const requireAdmin = createMiddleware<{
    Variables: { userId?: string; userRole?: string };
  }>(async (c, next) => {
    if (c.get("userRole") !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });

  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.post("/", requireAuth, zValidator("json", createItemSubmissionSchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const result = await container.itemSubmissionService.createDraft(userId, body);
    return result.match(
      (data) => c.json({ data }, 201),
      (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
    );
  });

  r.get("/mine", requireAuth, zValidator("query", listSubmissionsQuerySchema), async (c) => {
    const userId = c.get("userId") as string;
    const q = c.req.valid("query");
    const rows = await container.itemSubmissionService.listForSeller(userId, {
      status: q.status,
      limit: q.limit,
      offset: q.offset,
    });
    return c.json({ data: rows });
  });

  r.get(
    "/",
    requireAuth,
    requireAdmin,
    zValidator("query", listSubmissionsQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const rows = await container.itemSubmissionService.listForAdmin({
        status: q.status,
        sellerId: q.sellerId,
        limit: q.limit,
        offset: q.offset,
      });
      return c.json({ data: rows });
    },
  );

  r.get("/:id", requireAuth, zValidator("param", submissionIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const role = c.get("userRole") ?? "user";
    const userId = c.get("userId") as string;
    if (role === "admin") {
      const result = await container.itemSubmissionService.getForAdmin(id);
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
      );
    }
    const result = await container.itemSubmissionService.getForSeller(userId, id);
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
    );
  });

  r.patch("/:id", requireAuth, zValidator("param", submissionIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const role = c.get("userRole") ?? "user";
    const userId = c.get("userId") as string;
    let raw: unknown = {};
    try {
      raw = await c.req.json();
    } catch {
      raw = {};
    }
    if (role === "admin") {
      const parsed = adminSubmissionNotesSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
      }
      const result = await container.itemSubmissionService.updateForActor({
        actorId: userId,
        role,
        submissionId: id,
        adminNotes: parsed.data,
      });
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
      );
    }
    const parsed = updateItemSubmissionSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
    }
    const result = await container.itemSubmissionService.updateForActor({
      actorId: userId,
      role,
      submissionId: id,
      sellerPatch: parsed.data as UpdateItemSubmissionInput,
    });
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
    );
  });

  r.post("/:id/submit", requireAuth, zValidator("param", submissionIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const result = await container.itemSubmissionService.submitForReview(userId, id);
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
    );
  });

  r.post("/:id/withdraw", requireAuth, zValidator("param", submissionIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const result = await container.itemSubmissionService.withdraw(userId, id);
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
    );
  });

  r.post(
    "/:id/review/start",
    requireAuth,
    requireAdmin,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const result = await container.itemSubmissionService.startReview(adminId, id);
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
      );
    },
  );

  r.post(
    "/:id/approve",
    requireAuth,
    requireAdmin,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", approveSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { reviewNotes } = c.req.valid("json");
      const result = await container.itemSubmissionService.approve(adminId, id, reviewNotes);
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
      );
    },
  );

  r.post(
    "/:id/reject",
    requireAuth,
    requireAdmin,
    zValidator("param", submissionIdParamSchema),
    zValidator("json", rejectSubmissionBodySchema),
    async (c) => {
      const adminId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const { rejectionReason, reviewNotes } = c.req.valid("json");
      const result = await container.itemSubmissionService.reject(
        adminId,
        id,
        rejectionReason,
        reviewNotes,
      );
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
      );
    },
  );

  return r;
}
