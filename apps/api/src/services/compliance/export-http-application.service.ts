import { AuthzError } from "@auction/exports/providers";
import type { CreateExportBody, ExportPreviewBody } from "@auction/validators";
import { asHttpStatus } from "../../lib/http-status.js";
import type { ExportService } from "../export/export.service.js";
import type {
  ComplianceExportCreateResult,
  ComplianceExportDownloadResult,
  IExportHttpApplicationService,
} from "../interfaces/compliance-routes/compliance-export-http.js";
import type {
  ComplianceHttpJson,
  ComplianceViewerContext,
} from "../interfaces/compliance-routes/compliance-route-http.js";

function mapExportAuthzError(e: unknown): ComplianceHttpJson | null {
  if (e instanceof AuthzError) {
    return {
      status: asHttpStatus(e.status),
      body: { error: e.message, code: "export_forbidden" },
    };
  }
  return null;
}

function viewerAuth(input: {
  viewer: ComplianceViewerContext;
  requireRole?: boolean;
}): ComplianceHttpJson | null {
  if (!input.viewer.userId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  if (input.requireRole && !input.viewer.role) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  return null;
}

export class ExportHttpApplicationService implements IExportHttpApplicationService {
  constructor(private readonly exportService: ExportService) {}

  async createExport(input: {
    viewer: ComplianceViewerContext;
    body: CreateExportBody;
  }): Promise<ComplianceExportCreateResult> {
    const denied = viewerAuth({ viewer: input.viewer, requireRole: true });
    if (denied) return { kind: "json", ...denied };

    try {
      const result = await this.exportService.createExport({
        userId: input.viewer.userId,
        userRole: input.viewer.role as string,
        userStaffRole: input.viewer.staffRole ?? null,
        body: input.body,
      });

      if (result.mode === "sync") {
        return {
          kind: "sync_stream",
          contentType: result.contentType,
          filename: result.filename,
          stream: result.stream,
        };
      }

      return {
        kind: "json",
        status: result.mode === "existing" ? 200 : 202,
        body: { mode: result.mode, job: result.job },
      };
    } catch (e) {
      const mapped = mapExportAuthzError(e);
      if (mapped) return { kind: "json", status: mapped.status, body: mapped.body };
      throw e;
    }
  }

  async previewExport(input: {
    viewer: ComplianceViewerContext;
    body: ExportPreviewBody;
  }): Promise<ComplianceHttpJson> {
    const denied = viewerAuth({ viewer: input.viewer, requireRole: true });
    if (denied) return denied;

    try {
      const preview = await this.exportService.previewExport({
        userId: input.viewer.userId,
        userRole: input.viewer.role as string,
        userStaffRole: input.viewer.staffRole ?? null,
        body: input.body,
      });
      return { status: 200, body: preview };
    } catch (e) {
      const mapped = mapExportAuthzError(e);
      if (mapped) return mapped;
      throw e;
    }
  }

  async listExports(userId: string): Promise<ComplianceHttpJson> {
    if (!userId) return { status: 401, body: { error: "Unauthorized" } };
    const jobs = await this.exportService.listExports(userId);
    return { status: 200, body: { data: jobs } };
  }

  async getExport(userId: string, exportId: string): Promise<ComplianceHttpJson> {
    if (!userId) return { status: 401, body: { error: "Unauthorized" } };
    const job = await this.exportService.getExport(userId, exportId);
    if (!job) return { status: 404, body: { error: "Not found" } };
    return { status: 200, body: { job } };
  }

  async getDownload(userId: string, exportId: string): Promise<ComplianceExportDownloadResult> {
    if (!userId) return { kind: "json", status: 401, body: { error: "Unauthorized" } };
    const dl = await this.exportService.getDownloadUrl(userId, exportId);
    if (!dl) {
      return { kind: "json", status: 404, body: { error: "Download not available" } };
    }
    return { kind: "redirect", url: dl.url };
  }

  async cancelExport(userId: string, exportId: string): Promise<ComplianceHttpJson> {
    if (!userId) return { status: 401, body: { error: "Unauthorized" } };
    const job = await this.exportService.cancelExport(userId, exportId);
    if (!job) return { status: 404, body: { error: "Not found" } };
    return { status: 200, body: { job } };
  }
}
