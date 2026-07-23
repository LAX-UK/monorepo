export type {
  VeriffWebhookHttpResult,
  VeriffWebhookIngressErrorResult,
  VeriffWebhookIngressResult,
  IVeriffWebhookIngressApplicationService,
} from "./compliance-veriff-webhook-ingress.js";
export type {
  BuyerSourceOfFundsViewResult,
  IBuyerComplianceHttpApplicationService,
} from "./compliance-buyer-http.js";
export type {
  ComplianceHttpJson,
  ComplianceViewerContext,
} from "./compliance-route-http.js";
export type { IKycHttpApplicationService } from "./compliance-kyc-http.js";
export type { IUploadHttpApplicationService } from "./compliance-upload-http.js";
export type {
  ComplianceExportCreateResult,
  ComplianceExportDownloadResult,
  IExportHttpApplicationService,
} from "./compliance-export-http.js";
export type { ILotDocumentHttpApplicationService } from "./compliance-lot-document-http.js";
export type { ISaleDocumentHttpApplicationService } from "./compliance-sale-document-http.js";

import type { IBuyerComplianceHttpApplicationService } from "./compliance-buyer-http.js";
import type { IExportHttpApplicationService } from "./compliance-export-http.js";
import type { IKycHttpApplicationService } from "./compliance-kyc-http.js";
import type { ILotDocumentHttpApplicationService } from "./compliance-lot-document-http.js";
import type { ISaleDocumentHttpApplicationService } from "./compliance-sale-document-http.js";
import type { IUploadHttpApplicationService } from "./compliance-upload-http.js";
import type { IVeriffWebhookIngressApplicationService } from "./compliance-veriff-webhook-ingress.js";

export type ComplianceRouteServices = {
  veriffWebhooks: IVeriffWebhookIngressApplicationService;
  buyerComplianceHttp: IBuyerComplianceHttpApplicationService;
  kycHttp: IKycHttpApplicationService;
  uploadHttp: IUploadHttpApplicationService;
  exportHttp: IExportHttpApplicationService;
  lotDocumentHttp: ILotDocumentHttpApplicationService;
  saleDocumentHttp: ISaleDocumentHttpApplicationService;
};

export type {
  ComplianceBuyerHttpRoutesContainer,
  ComplianceExportRoutesContainer,
  ComplianceKycRoutesContainer,
  ComplianceLotDocumentRoutesContainer,
  ComplianceSaleDocumentRoutesContainer,
  ComplianceUploadRoutesContainer,
  ComplianceVeriffWebhookRoutesContainer,
} from "./compliance-route-container-slices.js";
