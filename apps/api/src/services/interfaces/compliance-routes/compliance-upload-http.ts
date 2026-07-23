import type { ComplianceHttpJson } from "./compliance-route-http.js";
import type { ComplianceViewerContext } from "./compliance-route-http.js";

export interface IUploadHttpApplicationService {
  putLocalPresignedUpload(input: {
    token: string;
    body: Buffer;
    contentType: string;
  }): Promise<ComplianceHttpJson | { kind: "empty"; status: number }>;

  createPresignedUpload(input: {
    viewer: ComplianceViewerContext;
    kind: string;
    contentType: string;
    byteSize: number;
  }): Promise<ComplianceHttpJson>;

  confirmUpload(input: {
    viewer: ComplianceViewerContext;
    uploadId: string;
  }): Promise<ComplianceHttpJson>;

  getUploadStatus(input: {
    viewer: ComplianceViewerContext;
    uploadId: string;
  }): Promise<ComplianceHttpJson>;
}
