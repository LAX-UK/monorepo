import type { ComplianceRouteServices } from "./index.js";

type ComplianceRoutePick<K extends keyof ComplianceRouteServices> = {
  compliance: Pick<ComplianceRouteServices, K>;
};

export type ComplianceVeriffWebhookRoutesContainer = ComplianceRoutePick<"veriffWebhooks">;

export type ComplianceBuyerHttpRoutesContainer = ComplianceRoutePick<"buyerComplianceHttp">;

export type ComplianceKycRoutesContainer = ComplianceRoutePick<"kycHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type ComplianceUploadRoutesContainer = ComplianceRoutePick<"uploadHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type ComplianceExportRoutesContainer = ComplianceRoutePick<"exportHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type ComplianceLotDocumentRoutesContainer = ComplianceRoutePick<"lotDocumentHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type ComplianceSaleDocumentRoutesContainer = ComplianceRoutePick<"saleDocumentHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;
