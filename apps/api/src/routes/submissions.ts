import type { UpdateItemSubmissionInput } from "@auction/types";
import { roleHasCapability, type UserRole } from "@auction/types";
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
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireBuyerRole,
  requireBuyerRoleUnlessAdministrator,
} from "../middleware/require-buyer-role.js";
import { requirePlatformAdmin } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createSubmissionRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
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
    requirePlatformAdmin,
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
    const role = (c.get("userRole") ?? "client") as UserRole;
    const userId = c.get("userId") as string;
    if (roleHasCapability(role, "platform.admin.full")) {
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

  r.patch(
    "/:id",
    requireAuth,
    requireBuyerRoleUnlessAdministrator,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
    const { id } = c.req.valid("param");
    const role = (c.get("userRole") ?? "client") as UserRole;
    const userId = c.get("userId") as string;
    let raw: unknown = {};
    try {
      raw = await c.req.json();
    } catch {
      raw = {};
    }
    if (roleHasCapability(role, "platform.admin.full")) {
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
    },
  );

  r.post(
    "/:id/submit",
    requireAuth,
    requireBuyerRole,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const result = await container.itemSubmissionService.submitForReview(userId, id);
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
    );
    },
  );

  r.post(
    "/:id/withdraw",
    requireAuth,
    requireBuyerRole,
    zValidator("param", submissionIdParamSchema),
    async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const result = await container.itemSubmissionService.withdraw(userId, id);
    return result.match(
      (data) => c.json({ data }),
      (e) => c.json({ error: e.message }, asHttpStatus(e.status)),
    );
    },
  );

  r.post(
    "/:id/review/start",
    requireAuth,
    requirePlatformAdmin,
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
    requirePlatformAdmin,
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
    requirePlatformAdmin,
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
