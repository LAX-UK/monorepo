import { EntityDocumentError, type EntityDocumentService } from "../entity-document.service.js";
import type { ILotDocumentHttpApplicationService } from "../interfaces/compliance-routes/compliance-lot-document-http.js";
import type { ComplianceHttpJson } from "../interfaces/compliance-routes/compliance-route-http.js";

export class LotDocumentHttpApplicationService implements ILotDocumentHttpApplicationService {
  constructor(private readonly lotDocumentService: EntityDocumentService<string>) {}

  private mapDocumentError(e: unknown): ComplianceHttpJson | null {
    if (e instanceof EntityDocumentError && e.code === "upload_not_active") {
      return { status: 400, body: { error: e.code } };
    }
    return null;
  }

  async list(lotId: string): Promise<ComplianceHttpJson> {
    const data = await this.lotDocumentService.list(lotId);
    return { status: 200, body: { data } };
  }

  async attach(input: {
    lotId: string;
    body: Parameters<ILotDocumentHttpApplicationService["attach"]>[0]["body"];
    viewer: Parameters<ILotDocumentHttpApplicationService["attach"]>[0]["viewer"];
  }): Promise<ComplianceHttpJson> {
    try {
      const doc = await this.lotDocumentService.attach({
        entityId: input.lotId,
        kind: input.body.kind,
        label: input.body.label ?? null,
        uploadObjectId: input.body.uploadObjectId,
        userId: input.viewer.userId,
      });
      return { status: 201, body: { data: doc } };
    } catch (e) {
      const mapped = this.mapDocumentError(e);
      if (mapped) return mapped;
      throw e;
    }
  }

  async remove(lotId: string, documentId: string): Promise<ComplianceHttpJson> {
    await this.lotDocumentService.remove(lotId, documentId);
    return { status: 204, body: null };
  }
}
