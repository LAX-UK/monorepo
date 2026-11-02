import { X_ENQUIRY_DRAFT_HEADER } from "@auction/http-headers";
import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
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
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRoles?: StaffRoles | undefined;
      enquiryDraftId?: string;
    };
  }>();

  /**
   * A visitor without an account sends the draft token they were given for their enquiry instead
   * of a session. A token that is present but no longer good is refused, never read as "signed
   * out", so the page can tell the visitor to start the upload again.
   */
  const sessionOrDraft = createMiddleware<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRoles?: StaffRoles | undefined;
      enquiryDraftId?: string;
    };
  }>(async (c, next) => {
    const token = c.req.header(X_ENQUIRY_DRAFT_HEADER);
    if (token === undefined) return requireAuth(c, next);
    const draft = container.enquiryDraftTokens.verify(token);
    if (!draft) {
      return c.json(
        {
          error: "Your upload session has ended. Reload the page to start again.",
          code: "draft_expired",
        },
        401,
      );
    }
    c.set("enquiryDraftId", draft.draftId);
    await next();
  });

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

  r.post("/presign", sessionOrDraft, async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const input = body as { kind?: unknown; contentType?: unknown; byteSize?: unknown };
    const file = {
      kind: typeof input.kind === "string" ? input.kind : "",
      contentType: typeof input.contentType === "string" ? input.contentType : "",
      byteSize: Number(input.byteSize),
    };
    const draftId = c.get("enquiryDraftId");
    const response = draftId
      ? await uploadHttp.createDraftPresignedUpload({ draftId, ...file })
      : await uploadHttp.createPresignedUpload({ viewer: complianceViewerFromContext(c), ...file });
    return respondComplianceHttpJson(c, response);
  });

  r.post("/confirm", sessionOrDraft, async (c) => {
    const body = await c.req.json().catch(() => null);
    const uploadId =
      body &&
      typeof body === "object" &&
      typeof (body as { uploadId?: unknown }).uploadId === "string"
        ? (body as { uploadId: string }).uploadId
        : "";
    const draftId = c.get("enquiryDraftId");
    const response = draftId
      ? await uploadHttp.confirmDraftUpload({ draftId, uploadId })
      : await uploadHttp.confirmUpload({ viewer: complianceViewerFromContext(c), uploadId });
    return respondComplianceHttpJson(c, response);
  });

  r.get("/:uploadId", sessionOrDraft, async (c) => {
    const uploadId = c.req.param("uploadId");
    const draftId = c.get("enquiryDraftId");
    const response = draftId
      ? await uploadHttp.getDraftUploadStatus({ draftId, uploadId })
      : await uploadHttp.getUploadStatus({ viewer: complianceViewerFromContext(c), uploadId });
    return respondComplianceHttpJson(c, response);
  });

  return r;
}
