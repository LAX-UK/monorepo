import type { SourceOfFundsDocumentCollectionService } from "../../source-of-funds/source-of-funds-document-collection.service.js";

export type BuyerSourceOfFundsViewResult = {
  data: Awaited<ReturnType<SourceOfFundsDocumentCollectionService["getBuyerView"]>>;
};

export interface IBuyerComplianceHttpApplicationService {
  getBuyerSourceOfFundsView(buyerUserId: string): Promise<BuyerSourceOfFundsViewResult>;
}
