import { getBuyerSourceOfFundsView } from "@/lib/data/http/compliance-sof.reader";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type { AttachBuyerSofDocumentBody, IBuyerSofService } from "../interfaces/buyer-sof-service";

export class BuyerSofService implements IBuyerSofService {
  constructor(private readonly api: IAuthedApiClient) {}

  async getView() {
    return getBuyerSourceOfFundsView();
  }

  async attachDocument(
    caseId: string,
    body: AttachBuyerSofDocumentBody,
  ): Promise<ServiceResult<void>> {
    return this.api.json<void>(
      `/payments/me/source-of-funds/${encodeURIComponent(caseId)}/documents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  async submitDocuments(caseId: string): Promise<ServiceResult<void>> {
    return this.api.json<void>(
      `/payments/me/source-of-funds/${encodeURIComponent(caseId)}/documents/submit`,
      { method: "POST" },
    );
  }
}
