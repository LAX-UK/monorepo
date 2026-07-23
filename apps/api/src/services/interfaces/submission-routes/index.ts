import type { ISubmissionAdminHttpApplicationService } from "./submission-admin-http.js";
import type { ISubmissionDocumentHttpApplicationService } from "./submission-document-http.js";
import type { ISubmissionSellerHttpApplicationService } from "./submission-seller-http.js";

export type SubmissionRouteServices = {
  sellerHttp: ISubmissionSellerHttpApplicationService;
  adminHttp: ISubmissionAdminHttpApplicationService;
  documentHttp: ISubmissionDocumentHttpApplicationService;
};

export type {
  SubmissionHttpJson,
  SubmissionLegalEntityContext,
  SubmissionViewerContext,
} from "./submission-route-http.js";
export type { ISubmissionSellerHttpApplicationService } from "./submission-seller-http.js";
export type { ISubmissionAdminHttpApplicationService } from "./submission-admin-http.js";
export type { ISubmissionDocumentHttpApplicationService } from "./submission-document-http.js";
export type { ISubmissionDocumentPort } from "./submission-document-port.js";

export type {
  SubmissionAdminRoutesContainer,
  SubmissionDocumentRoutesContainer,
  SubmissionSellerRoutesContainer,
} from "./submission-route-container-slices.js";
