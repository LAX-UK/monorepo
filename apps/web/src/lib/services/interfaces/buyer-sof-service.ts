import type { BuyerSourceOfFundsView } from "@/lib/data/http/compliance-sof.mapper";
import type { ServiceResult } from "../http/service-result";

export type AttachBuyerSofDocumentBody = {
  uploadObjectId: string;
  requestedType: string;
  label: string;
};

export interface IBuyerSofService {
  getView(): Promise<BuyerSourceOfFundsView | null>;
  attachDocument(caseId: string, body: AttachBuyerSofDocumentBody): Promise<ServiceResult<void>>;
  submitDocuments(caseId: string): Promise<ServiceResult<void>>;
}
