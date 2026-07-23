import { describe, expect, it } from "vitest";
import type { Container } from "../../container.js";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { AdminComplianceRoutesContainer } from "../interfaces/admin-routes/admin-route-container-slices.js";
import type {
  ComplianceBuyerHttpRoutesContainer,
  ComplianceExportRoutesContainer,
  ComplianceKycRoutesContainer,
  ComplianceLotDocumentRoutesContainer,
  ComplianceSaleDocumentRoutesContainer,
  ComplianceUploadRoutesContainer,
  ComplianceVeriffWebhookRoutesContainer,
} from "../interfaces/compliance-routes/compliance-route-container-slices.js";
import type { FinancePayoutStatementRoutesContainer } from "../interfaces/finance-routes/finance-route-container-slices.js";

type AssertAssignable<T extends U, U> = T;
type AssertNotAssignable<T, U> = T extends U ? never : T;

declare const container: Container;

type _VeriffFromContainer = AssertAssignable<Container, ComplianceVeriffWebhookRoutesContainer>;
type _VeriffMustNotSeeFinanceStatement = AssertNotAssignable<
  ComplianceVeriffWebhookRoutesContainer,
  FinancePayoutStatementRoutesContainer
>;
type _AdminComplianceFromContainer = AssertAssignable<Container, AdminComplianceRoutesContainer>;
type _BuyerHttpMustNotSeeAdminCompliance = AssertNotAssignable<
  ComplianceBuyerHttpRoutesContainer,
  AdminComplianceRoutesContainer
>;
type _KycFromContainer = AssertAssignable<Container, ComplianceKycRoutesContainer>;
type _KycMustNotSeeExportHttp = AssertNotAssignable<
  ComplianceKycRoutesContainer,
  ComplianceExportRoutesContainer
>;
type _UploadFromContainer = AssertAssignable<Container, ComplianceUploadRoutesContainer>;
type _UploadMustNotSeeKycHttp = AssertNotAssignable<
  ComplianceUploadRoutesContainer,
  ComplianceKycRoutesContainer
>;
type _ExportFromContainer = AssertAssignable<Container, ComplianceExportRoutesContainer>;
type _ExportMustNotSeeUploadHttp = AssertNotAssignable<
  ComplianceExportRoutesContainer,
  ComplianceUploadRoutesContainer
>;
type _LotDocFromContainer = AssertAssignable<Container, ComplianceLotDocumentRoutesContainer>;
type _LotDocMustNotSeeSaleDocHttp = AssertNotAssignable<
  ComplianceLotDocumentRoutesContainer,
  ComplianceSaleDocumentRoutesContainer
>;
type _SaleDocFromContainer = AssertAssignable<Container, ComplianceSaleDocumentRoutesContainer>;
type _SaleDocMustNotSeeLotDocHttp = AssertNotAssignable<
  ComplianceSaleDocumentRoutesContainer,
  ComplianceLotDocumentRoutesContainer
>;
type _KycMustNotSeeAmlService = AssertNotAssignable<
  ComplianceKycRoutesContainer,
  Pick<Container, "amlService">
>;

type _ComplianceSliceContract = [
  _VeriffFromContainer,
  _VeriffMustNotSeeFinanceStatement,
  _AdminComplianceFromContainer,
  _BuyerHttpMustNotSeeAdminCompliance,
  _KycFromContainer,
  _KycMustNotSeeExportHttp,
  _UploadFromContainer,
  _UploadMustNotSeeKycHttp,
  _ExportFromContainer,
  _ExportMustNotSeeUploadHttp,
  _LotDocFromContainer,
  _LotDocMustNotSeeSaleDocHttp,
  _SaleDocFromContainer,
  _SaleDocMustNotSeeLotDocHttp,
  _KycMustNotSeeAmlService,
];

defineCompileTimeContract<_ComplianceSliceContract>();

describe("compliance route container slices", () => {
  it("compile-time slice contracts are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
