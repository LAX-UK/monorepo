import { describe, expect, it } from "vitest";
import type { Container } from "../../container.js";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type {
  AdminCatalogRoutesContainer,
  AdminComplianceRoutesContainer,
  AdminFinancePayoutRoutesContainer,
  AdminOperationsSaleroomRoutesContainer,
  AdminOpsMetricsRoutesContainer,
} from "../interfaces/admin-routes/admin-route-container-slices.js";

type AssertAssignable<T extends U, U> = T;
type AssertNotAssignable<T, U> = T extends U ? never : T;

declare const container: Container;

type _CatalogFromContainer = AssertAssignable<Container, AdminCatalogRoutesContainer>;
type _OpsMetricsFromContainer = AssertAssignable<Container, AdminOpsMetricsRoutesContainer>;
type _PayoutFromContainer = AssertAssignable<Container, AdminFinancePayoutRoutesContainer>;
type _SaleroomFromContainer = AssertAssignable<Container, AdminOperationsSaleroomRoutesContainer>;
type _ComplianceFromContainer = AssertAssignable<Container, AdminComplianceRoutesContainer>;

type _CatalogMustNotSeePayouts = AssertNotAssignable<
  AdminCatalogRoutesContainer,
  AdminFinancePayoutRoutesContainer
>;
type _SaleroomMustNotSeePayouts = AssertNotAssignable<
  AdminOperationsSaleroomRoutesContainer,
  AdminFinancePayoutRoutesContainer
>;

type _RouteSliceContract = [
  _CatalogFromContainer,
  _OpsMetricsFromContainer,
  _PayoutFromContainer,
  _SaleroomFromContainer,
  _ComplianceFromContainer,
  _CatalogMustNotSeePayouts,
  _SaleroomMustNotSeePayouts,
];

defineCompileTimeContract<_RouteSliceContract>();

describe("admin route container slices", () => {
  it("compile-time slice contracts are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
