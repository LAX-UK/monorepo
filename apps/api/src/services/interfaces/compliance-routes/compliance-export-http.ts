import type { CreateExportBody, ExportPreviewBody } from "@auction/validators";
import type { ComplianceHttpJson, ComplianceViewerContext } from "./compliance-route-http.js";

export type ComplianceExportCreateResult =
  | {
      kind: "sync_stream";
      contentType: string;
      filename: string;
      stream: AsyncIterable<unknown>;
    }
  | { kind: "json"; status: number; body: unknown };

export type ComplianceExportDownloadResult =
  | { kind: "redirect"; url: string }
  | { kind: "json"; status: number; body: unknown };

export interface IExportHttpApplicationService {
  createExport(input: {
    viewer: ComplianceViewerContext;
    body: CreateExportBody;
  }): Promise<ComplianceExportCreateResult>;

  previewExport(input: {
    viewer: ComplianceViewerContext;
    body: ExportPreviewBody;
  }): Promise<ComplianceHttpJson>;

  listExports(userId: string): Promise<ComplianceHttpJson>;

  getExport(userId: string, exportId: string): Promise<ComplianceHttpJson>;

  getDownload(userId: string, exportId: string): Promise<ComplianceExportDownloadResult>;

  cancelExport(userId: string, exportId: string): Promise<ComplianceHttpJson>;
}
