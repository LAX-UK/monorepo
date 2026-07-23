import { Hono } from "hono";
import type { ContainerUploadRoutesSlice } from "../container.js";
import {
  complianceViewerFromContext,
  respondComplianceHttpJson,
} from "../lib/compliance-route-response.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createUploadRoutes(
  container: ContainerUploadRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const uploadHttp = container.compliance.uploadHttp;
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.put("/local/:token", async (c) => {
    const buf = Buffer.from(await c.req.arrayBuffer());
    const contentType = c.req.header("content-type") ?? "application/octet-stream";
    const response = await uploadHttp.putLocalPresignedUpload({
      token: c.req.param("token"),
      body: buf,
      contentType,
    });
    if ("kind" in response) {
      return c.body(null, 200 as const);
    }
    return respondComplianceHttpJson(c, response);
  });

  r.post("/presign", requireAuth, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const input = body as { kind?: unknown; contentType?: unknown; byteSize?: unknown };
    const response = await uploadHttp.createPresignedUpload({
      viewer: complianceViewerFromContext(c),
      kind: typeof input.kind === "string" ? input.kind : "",
      contentType: typeof input.contentType === "string" ? input.contentType : "",
      byteSize: Number(input.byteSize),
    });
    return respondComplianceHttpJson(c, response);
  });

  r.post("/confirm", requireAuth, async (c) => {
    const body = await c.req.json().catch(() => null);
    const uploadId =
      body &&
      typeof body === "object" &&
      typeof (body as { uploadId?: unknown }).uploadId === "string"
        ? (body as { uploadId: string }).uploadId
        : "";
    const response = await uploadHttp.confirmUpload({
      viewer: complianceViewerFromContext(c),
      uploadId,
    });
    return respondComplianceHttpJson(c, response);
  });

  r.get("/:uploadId", requireAuth, async (c) => {
    const response = await uploadHttp.getUploadStatus({
      viewer: complianceViewerFromContext(c),
      uploadId: c.req.param("uploadId"),
    });
    return respondComplianceHttpJson(c, response);
  });

  return r;
}
