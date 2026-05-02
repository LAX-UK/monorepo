import type { UserRole } from "@auction/types";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createUploadRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.put("/local/:token", async (c) => {
    if (container.env.STORAGE_DRIVER !== "local") {
      return c.json({ error: "Not found" }, 404);
    }
    let key: string;
    try {
      key = Buffer.from(c.req.param("token"), "base64url").toString("utf8");
    } catch {
      return c.json({ error: "Invalid upload token" }, 400);
    }
    const buf = Buffer.from(await c.req.arrayBuffer());
    const contentType = c.req.header("content-type") ?? "application/octet-stream";
    await container.uploadService.putLocalPresignedUpload(key, buf, contentType);
    return c.body(null, 200);
  });

  r.post("/presign", requireAuth, async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole") as UserRole | undefined;
    if (!userId || !userRole) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const input = body as { kind?: unknown; contentType?: unknown; byteSize?: unknown };
    const result = await container.uploadService.createPresignedUpload({
      userId,
      userRole,
      kind: typeof input.kind === "string" ? input.kind : "",
      contentType: typeof input.contentType === "string" ? input.contentType : "",
      byteSize: Number(input.byteSize),
    });
    if (!result.ok) {
      return c.json(
        { error: result.error, ...(result.resetAt ? { resetAt: result.resetAt } : {}) },
        result.status as 400 | 403 | 429 | 500 | 503,
      );
    }
    return c.json({ data: result.value });
  });

  r.post("/confirm", requireAuth, async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole") as UserRole | undefined;
    if (!userId || !userRole) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json().catch(() => null);
    const uploadId =
      body &&
      typeof body === "object" &&
      typeof (body as { uploadId?: unknown }).uploadId === "string"
        ? (body as { uploadId: string }).uploadId
        : "";
    if (!uploadId) return c.json({ error: "uploadId is required" }, 400);
    const result = await container.uploadService.confirmUpload({ uploadId, userId, userRole });
    if (!result.ok) {
      return c.json({ error: result.error }, result.status as 400 | 404 | 409 | 503);
    }
    return c.json({ data: result.value });
  });

  r.get("/:uploadId", requireAuth, async (c) => {
    const userId = c.get("userId");
    const userRole = c.get("userRole") as UserRole | undefined;
    if (!userId || !userRole) return c.json({ error: "Unauthorized" }, 401);
    const result = await container.uploadService.getUploadStatus({
      uploadId: c.req.param("uploadId"),
      userId,
      userRole,
    });
    if (!result.ok) {
      return c.json({ error: result.error }, result.status as 404 | 503);
    }
    return c.json({ data: result.value });
  });

  return r;
}
