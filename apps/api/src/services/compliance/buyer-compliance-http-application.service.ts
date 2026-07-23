import type {
  BuyerSourceOfFundsViewResult,
  IBuyerComplianceHttpApplicationService,
} from "../interfaces/compliance-routes/compliance-buyer-http.js";
import type { SourceOfFundsDocumentCollectionService } from "../source-of-funds/source-of-funds-document-collection.service.js";

export class BuyerComplianceHttpApplicationService
  implements IBuyerComplianceHttpApplicationService
{
  constructor(private readonly sourceOfFundsDocuments: SourceOfFundsDocumentCollectionService) {}

  async getBuyerSourceOfFundsView(buyerUserId: string): Promise<BuyerSourceOfFundsViewResult> {
    const data = await this.sourceOfFundsDocuments.getBuyerView(buyerUserId);
    return { data };
  }
}
