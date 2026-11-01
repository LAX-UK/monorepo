import type { IConsignmentAfterSaleHttpApplicationService } from "./consignment-after-sale-http.js";
import type { IConsignmentAgreementHttpApplicationService } from "./consignment-agreement-http.js";
import type { IConsignmentMessageHttpApplicationService } from "./consignment-message-http.js";
import type { ISubmissionAdminHttpApplicationService } from "./submission-admin-http.js";
import type { ISubmissionDocumentHttpApplicationService } from "./submission-document-http.js";
import type { ISubmissionSellerHttpApplicationService } from "./submission-seller-http.js";

export type SubmissionRouteServices = {
  sellerHttp: ISubmissionSellerHttpApplicationService;
  adminHttp: ISubmissionAdminHttpApplicationService;
  documentHttp: ISubmissionDocumentHttpApplicationService;
  agreementHttp: IConsignmentAgreementHttpApplicationService;
  afterSaleHttp: IConsignmentAfterSaleHttpApplicationService;
  messageHttp: IConsignmentMessageHttpApplicationService;
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
  AgreementSellerContext,
  IConsignmentAgreementHttpApplicationService,
} from "./consignment-agreement-http.js";
export type {
  IConsignmentMessageClientHttp,
  IConsignmentMessageHttpApplicationService,
  IConsignmentMessageStaffHttp,
} from "./consignment-message-http.js";
export type {
  IConsignmentAfterSaleHttpApplicationService,
  IConsignmentAfterSaleSellerHttp,
  IConsignmentAfterSaleStaffHttp,
} from "./consignment-after-sale-http.js";

export type {
  SubmissionAdminRoutesContainer,
  SubmissionDocumentRoutesContainer,
  SubmissionSellerRoutesContainer,
} from "./submission-route-container-slices.js";
