import type { EntityDocument } from "@auction/types";
import type { ServiceResult } from "../http/service-result";

export type AdminAttachDocumentInput = {
  uploadObjectId: string;
  kind: string;
  label: string | null;
};

export interface IAdminDocumentsService {
  attachSaleDocument(
    saleId: string,
    input: AdminAttachDocumentInput,
  ): Promise<ServiceResult<EntityDocument>>;
  removeSaleDocument(saleId: string, documentId: string): Promise<ServiceResult<void>>;
  attachLotDocument(
    lotId: string,
    input: AdminAttachDocumentInput,
  ): Promise<ServiceResult<EntityDocument>>;
  removeLotDocument(lotId: string, documentId: string): Promise<ServiceResult<void>>;
  attachSubmissionDocument(
    submissionId: string,
    input: AdminAttachDocumentInput,
  ): Promise<ServiceResult<EntityDocument>>;
  removeSubmissionDocument(submissionId: string, documentId: string): Promise<ServiceResult<void>>;
}
