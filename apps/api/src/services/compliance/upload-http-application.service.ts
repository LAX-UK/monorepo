import { type UserRole, normalizeUserStaffRole } from "@auction/types";
import type {
  ComplianceHttpJson,
  ComplianceViewerContext,
} from "../interfaces/compliance-routes/compliance-route-http.js";
import type { IUploadHttpApplicationService } from "../interfaces/compliance-routes/compliance-upload-http.js";
import type { IUploadService } from "../interfaces/upload-service.js";

export class UploadHttpApplicationService implements IUploadHttpApplicationService {
  constructor(
    private readonly uploadService: IUploadService,
    private readonly storageDriver: string,
  ) {}

  async putLocalPresignedUpload(input: {
    token: string;
    body: Buffer;
    contentType: string;
  }): Promise<ComplianceHttpJson | { kind: "empty"; status: number }> {
    if (this.storageDriver !== "local") {
      return { status: 404, body: { error: "Not found" } };
    }
    let key: string;
    try {
      key = Buffer.from(input.token, "base64url").toString("utf8");
    } catch {
      return { status: 400, body: { error: "Invalid upload token" } };
    }
    await this.uploadService.putLocalPresignedUpload(key, input.body, input.contentType);
    return { kind: "empty", status: 200 };
  }

  async createPresignedUpload(input: {
    viewer: ComplianceViewerContext;
    kind: string;
    contentType: string;
    byteSize: number;
  }): Promise<ComplianceHttpJson> {
    const auth = this.requireViewer(input.viewer);
    if (auth) return auth;

    const staff = normalizeUserStaffRole(input.viewer.staffRole ?? undefined);
    const result = await this.uploadService.createPresignedUpload({
      userId: input.viewer.userId,
      userRole: input.viewer.role as UserRole,
      userStaffRole: staff,
      kind: input.kind,
      contentType: input.contentType,
      byteSize: input.byteSize,
    });
    if (!result.ok) {
      return {
        status: result.status,
        body: { error: result.error, ...(result.resetAt ? { resetAt: result.resetAt } : {}) },
      };
    }
    return { status: 200, body: { data: result.value } };
  }

  async confirmUpload(input: {
    viewer: ComplianceViewerContext;
    uploadId: string;
  }): Promise<ComplianceHttpJson> {
    const auth = this.requireViewer(input.viewer);
    if (auth) return auth;
    if (!input.uploadId) {
      return { status: 400, body: { error: "uploadId is required" } };
    }

    const staff = normalizeUserStaffRole(input.viewer.staffRole ?? undefined);
    const result = await this.uploadService.confirmUpload({
      uploadId: input.uploadId,
      userId: input.viewer.userId,
      userRole: input.viewer.role as UserRole,
      userStaffRole: staff,
    });
    if (!result.ok) {
      return { status: result.status, body: { error: result.error } };
    }
    return { status: 200, body: { data: result.value } };
  }

  async getUploadStatus(input: {
    viewer: ComplianceViewerContext;
    uploadId: string;
  }): Promise<ComplianceHttpJson> {
    const auth = this.requireViewer(input.viewer);
    if (auth) return auth;

    const staff = normalizeUserStaffRole(input.viewer.staffRole ?? undefined);
    const result = await this.uploadService.getUploadStatus({
      uploadId: input.uploadId,
      userId: input.viewer.userId,
      userRole: input.viewer.role as UserRole,
      userStaffRole: staff,
    });
    if (!result.ok) {
      return { status: result.status, body: { error: result.error } };
    }
    return { status: 200, body: { data: result.value } };
  }

  private requireViewer(viewer: ComplianceViewerContext): ComplianceHttpJson | null {
    if (!viewer.userId || !viewer.role) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return null;
  }
}
