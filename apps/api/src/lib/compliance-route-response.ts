import type { Context } from "hono";
import { stream } from "hono/streaming";
import type { ComplianceExportCreateResult } from "../services/interfaces/compliance-routes/compliance-export-http.js";
import type { ComplianceExportDownloadResult } from "../services/interfaces/compliance-routes/compliance-export-http.js";
import type { ComplianceHttpJson } from "../services/interfaces/compliance-routes/compliance-route-http.js";
import { asHttpStatus } from "./http-status.js";

export function respondComplianceHttpJson(c: Context, response: ComplianceHttpJson) {
  if (response.status === 204) return c.body(null, 204);
  return c.json(response.body, asHttpStatus(response.status));
}

export function respondComplianceExportCreate(c: Context, result: ComplianceExportCreateResult) {
  if (result.kind === "sync_stream") {
    c.header("Content-Type", result.contentType);
    c.header("Content-Disposition", `attachment; filename="${result.filename}"`);
    return stream(c, async (s) => {
      for await (const chunk of result.stream) {
        await s.write(chunk as string | Uint8Array);
      }
    });
  }
  return c.json(result.body, asHttpStatus(result.status));
}

export function respondComplianceExportDownload(
  c: Context,
  result: ComplianceExportDownloadResult,
) {
  if (result.kind === "redirect") {
    return c.redirect(result.url, 302);
  }
  return c.json(result.body, asHttpStatus(result.status));
}

export function complianceViewerFromContext(c: {
  get: (key: "userId" | "userRole" | "userStaffRole") => string | null | undefined;
}) {
  return {
    userId: c.get("userId") as string,
    role: c.get("userRole"),
    staffRole: c.get("userStaffRole"),
  };
}
