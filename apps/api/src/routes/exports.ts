import { AuthzError } from "@auction/exports/providers";
import {
  createExportBodySchema,
  exportIdParamSchema,
  exportPreviewBodySchema,
} from "@auction/validators";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createExportRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });

  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
    };
  }>();

  r.use("*", requireAuth);

  r.post("/", zValidator("json", createExportBodySchema), async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    if (!userId || !userRole) return c.json({ error: "Unauthorized" }, 401);

    try {
      const result = await container.exportService.createExport({
        userId,
        userRole,
        userStaffRole: c.get("userStaffRole") ?? null,
        body: c.req.valid("json"),
      });

      if (result.mode === "sync") {
        c.header("Content-Type", result.contentType);
        c.header("Content-Disposition", `attachment; filename="${result.filename}"`);
        return stream(c, async (s) => {
          for await (const chunk of result.stream) {
            await s.write(chunk);
          }
        });
      }

      return c.json({ mode: result.mode, job: result.job }, result.mode === "existing" ? 200 : 202);
    } catch (e) {
      if (e instanceof AuthzError) {
        return c.json({ error: e.message, code: "export_forbidden" }, asHttpStatus(e.status));
      }
      throw e;
    }
  });

  r.post("/preview", zValidator("json", exportPreviewBodySchema), async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole");
    if (!userId || !userRole) return c.json({ error: "Unauthorized" }, 401);

    try {
      const preview = await container.exportService.previewExport({
        userId,
        userRole,
        userStaffRole: c.get("userStaffRole") ?? null,
        body: c.req.valid("json"),
      });
      return c.json(preview);
    } catch (e) {
      if (e instanceof AuthzError) {
        return c.json({ error: e.message, code: "export_forbidden" }, asHttpStatus(e.status));
      }
      throw e;
    }
  });

  r.get("/", async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const jobs = await container.exportService.listExports(userId);
    return c.json({ data: jobs });
  });

  r.get("/:id", zValidator("param", exportIdParamSchema), async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const job = await container.exportService.getExport(userId, c.req.valid("param").id);
    if (!job) return c.json({ error: "Not found" }, 404);
    return c.json({ job });
  });

  r.get("/:id/download", zValidator("param", exportIdParamSchema), async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const dl = await container.exportService.getDownloadUrl(userId, c.req.valid("param").id);
    if (!dl) return c.json({ error: "Download not available" }, 404);
    return c.redirect(dl.url, 302);
  });

  r.delete("/:id", zValidator("param", exportIdParamSchema), async (c) => {
    const userId = c.get("userId");
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const job = await container.exportService.cancelExport(userId, c.req.valid("param").id);
    if (!job) return c.json({ error: "Not found" }, 404);
    return c.json({ job });
  });

  return r;
}
