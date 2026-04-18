import { Hono } from "hono";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createUploadRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.post("/image", requireAuth, async (c) => {
    let body: Record<string, string | File>;
    try {
      body = await c.req.parseBody();
    } catch {
      return c.json({ error: "Invalid multipart body" }, 400);
    }
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: 'Expected multipart field "file" with a file' }, 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    try {
      const { url } = await container.uploadService.uploadImage(buf, contentType);
      return c.json({ data: { url } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      return c.json({ error: msg }, 400);
    }
  });

  return r;
}
