import {
  createExportBodySchema,
  exportIdParamSchema,
  exportPreviewBodySchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerExportRoutesSlice } from "../container.js";
import {
  complianceViewerFromContext,
  respondComplianceExportCreate,
  respondComplianceExportDownload,
  respondComplianceHttpJson,
} from "../lib/compliance-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createExportRoutes(
  container: ContainerExportRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const exportHttp = container.compliance.exportHttp;

  const r = new Hono<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
    };
  }>();

  r.use("*", requireAuth);

  r.post("/", zValidator("json", createExportBodySchema), async (c) => {
    const result = await exportHttp.createExport({
      viewer: complianceViewerFromContext(c),
      body: c.req.valid("json"),
    });
    return respondComplianceExportCreate(c, result);
  });

  r.post("/preview", zValidator("json", exportPreviewBodySchema), async (c) => {
    const response = await exportHttp.previewExport({
      viewer: complianceViewerFromContext(c),
      body: c.req.valid("json"),
    });
    return respondComplianceHttpJson(c, response);
  });

  r.get("/", async (c) => {
    const userId = c.get("userId");
    const response = await exportHttp.listExports(userId as string);
    return respondComplianceHttpJson(c, response);
  });

  r.get("/:id", zValidator("param", exportIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const response = await exportHttp.getExport(userId, c.req.valid("param").id);
    return respondComplianceHttpJson(c, response);
  });

  r.get("/:id/download", zValidator("param", exportIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const result = await exportHttp.getDownload(userId, c.req.valid("param").id);
    return respondComplianceExportDownload(c, result);
  });

  r.delete("/:id", zValidator("param", exportIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const response = await exportHttp.cancelExport(userId, c.req.valid("param").id);
    return respondComplianceHttpJson(c, response);
  });

  return r;
}
