import type { EntityDocument } from "@auction/types";
import type { IAuthedApiClient } from "../http/authed-api-client";
import { type ServiceResult, serviceFailure, serviceSuccess } from "../http/service-result";
import type {
  AdminAttachDocumentInput,
  IAdminDocumentsService,
} from "../interfaces/admin-documents-service";

const skipEntityHeader = { skipActingLegalEntityHeader: true as const };

function readEntityDocument(
  result: ServiceResult<{ data?: EntityDocument }>,
): ServiceResult<EntityDocument> {
  if (!result.ok) return result;
  const doc = result.data?.data;
  if (!doc) {
    return serviceFailure("invalid_response", result.status, result.data);
  }
  return serviceSuccess(doc, result.status);
}

export class AdminDocumentsService implements IAdminDocumentsService {
  constructor(private readonly api: IAuthedApiClient) {}

  async attachSaleDocument(saleId: string, input: AdminAttachDocumentInput) {
    return readEntityDocument(
      await this.api.json<{ data?: EntityDocument }>(`/sales/${saleId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        ...skipEntityHeader,
      }),
    );
  }

  removeSaleDocument(saleId: string, documentId: string) {
    return this.api
      .json<unknown>(`/sales/${saleId}/documents/${documentId}`, {
        method: "DELETE",
        ...skipEntityHeader,
      })
      .then((r) => (r.ok ? serviceSuccess(undefined, r.status) : r));
  }

  async attachLotDocument(lotId: string, input: AdminAttachDocumentInput) {
    return readEntityDocument(
      await this.api.json<{ data?: EntityDocument }>(`/lots/${lotId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        ...skipEntityHeader,
      }),
    );
  }

  removeLotDocument(lotId: string, documentId: string) {
    return this.api
      .json<unknown>(`/lots/${lotId}/documents/${documentId}`, {
        method: "DELETE",
        ...skipEntityHeader,
      })
      .then((r) => (r.ok ? serviceSuccess(undefined, r.status) : r));
  }

  async attachSubmissionDocument(submissionId: string, input: AdminAttachDocumentInput) {
    return readEntityDocument(
      await this.api.json<{ data?: EntityDocument }>(`/submissions/${submissionId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        ...skipEntityHeader,
      }),
    );
  }

  removeSubmissionDocument(submissionId: string, documentId: string) {
    return this.api
      .json<unknown>(`/submissions/${submissionId}/documents/${documentId}`, {
        method: "DELETE",
        ...skipEntityHeader,
      })
      .then((r) => (r.ok ? serviceSuccess(undefined, r.status) : r));
  }
}
