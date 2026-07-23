import { describe, expect, it } from "vitest";
import type { Container } from "../../container.js";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type {
  CatalogCategoryReadRoutesContainer,
  CatalogLotLifecycleWriteRoutesContainer,
  CatalogLotReadRoutesContainer,
  CatalogPressReadRoutesContainer,
  CatalogSaleFollowRoutesContainer,
  CatalogSaleLifecycleWriteRoutesContainer,
  CatalogSaleLotMembershipRoutesContainer,
  CatalogSaleReadRoutesContainer,
} from "../interfaces/catalog-routes/catalog-route-container-slices.js";
import type { FinancePayoutStatementRoutesContainer } from "../interfaces/finance-routes/finance-route-container-slices.js";

type AssertAssignable<T extends U, U> = T;
type AssertNotAssignable<T, U> = T extends U ? never : T;

declare const container: Container;

type _SaleFollowFromContainer = AssertAssignable<Container, CatalogSaleFollowRoutesContainer>;
type _SaleFollowMustNotSeeFinance = AssertNotAssignable<
  CatalogSaleFollowRoutesContainer,
  FinancePayoutStatementRoutesContainer
>;
type _SaleLifecycleFromContainer = AssertAssignable<
  Container,
  CatalogSaleLifecycleWriteRoutesContainer
>;
type _SaleLifecycleMustNotSeeFinance = AssertNotAssignable<
  CatalogSaleLifecycleWriteRoutesContainer,
  FinancePayoutStatementRoutesContainer
>;
type _SaleLotsFromContainer = AssertAssignable<Container, CatalogSaleLotMembershipRoutesContainer>;
type _LotLifecycleFromContainer = AssertAssignable<
  Container,
  CatalogLotLifecycleWriteRoutesContainer
>;

type _LotReadFromContainer = AssertAssignable<Container, CatalogLotReadRoutesContainer>;
type _SaleReadFromContainer = AssertAssignable<Container, CatalogSaleReadRoutesContainer>;
type _CategoryReadFromContainer = AssertAssignable<Container, CatalogCategoryReadRoutesContainer>;
type _PressReadFromContainer = AssertAssignable<Container, CatalogPressReadRoutesContainer>;
type _LotReadMustNotSeeFinance = AssertNotAssignable<
  CatalogLotReadRoutesContainer,
  FinancePayoutStatementRoutesContainer
>;
type _SaleReadMustNotSeeFinance = AssertNotAssignable<
  CatalogSaleReadRoutesContainer,
  FinancePayoutStatementRoutesContainer
>;

type _CatalogSliceContract = [
  _SaleFollowFromContainer,
  _SaleFollowMustNotSeeFinance,
  _SaleLifecycleFromContainer,
  _SaleLifecycleMustNotSeeFinance,
  _SaleLotsFromContainer,
  _LotLifecycleFromContainer,
  _LotReadFromContainer,
  _SaleReadFromContainer,
  _CategoryReadFromContainer,
  _PressReadFromContainer,
  _LotReadMustNotSeeFinance,
  _SaleReadMustNotSeeFinance,
];

defineCompileTimeContract<_CatalogSliceContract>();

describe("catalog route container slices", () => {
  it("compile-time slice contracts are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
