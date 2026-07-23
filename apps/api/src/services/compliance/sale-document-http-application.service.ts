import { EntityDocumentError, type EntityDocumentService } from "../entity-document.service.js";
import type { ComplianceHttpJson } from "../interfaces/compliance-routes/compliance-route-http.js";
import type { ISaleDocumentHttpApplicationService } from "../interfaces/compliance-routes/compliance-sale-document-http.js";

export class SaleDocumentHttpApplicationService implements ISaleDocumentHttpApplicationService {
  constructor(private readonly saleDocumentService: EntityDocumentService<string>) {}

  private mapDocumentError(e: unknown): ComplianceHttpJson | null {
    if (e instanceof EntityDocumentError && e.code === "upload_not_active") {
      return { status: 400, body: { error: e.code } };
    }
    return null;
  }

  async list(saleId: string): Promise<ComplianceHttpJson> {
    const data = await this.saleDocumentService.list(saleId);
    return { status: 200, body: { data } };
  }

  async attach(input: {
    saleId: string;
    body: Parameters<ISaleDocumentHttpApplicationService["attach"]>[0]["body"];
    viewer: Parameters<ISaleDocumentHttpApplicationService["attach"]>[0]["viewer"];
  }): Promise<ComplianceHttpJson> {
    try {
      const doc = await this.saleDocumentService.attach({
        entityId: input.saleId,
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

  async remove(saleId: string, documentId: string): Promise<ComplianceHttpJson> {
    await this.saleDocumentService.remove(saleId, documentId);
    return { status: 204, body: null };
  }
}
