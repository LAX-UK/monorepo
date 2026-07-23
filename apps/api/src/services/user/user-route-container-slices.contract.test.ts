import { describe, expect, it } from "vitest";
import type { Container } from "../../container.js";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { AdminComplianceRoutesContainer } from "../interfaces/admin-routes/admin-route-container-slices.js";
import type { FinancePayoutStatementRoutesContainer } from "../interfaces/finance-routes/finance-route-container-slices.js";
import type { UserAccountRoutesContainer } from "../interfaces/user-routes/user-route-container-slices.js";

type AssertAssignable<T extends U, U> = T;
type AssertNotAssignable<T, U> = T extends U ? never : T;

declare const container: Container;

type _UserAccountFromContainer = AssertAssignable<Container, UserAccountRoutesContainer>;
type _UserAccountMustNotSeeFinance = AssertNotAssignable<
  UserAccountRoutesContainer,
  FinancePayoutStatementRoutesContainer
>;
type _UserAccountMustNotSeeComplianceAdmin = AssertNotAssignable<
  UserAccountRoutesContainer,
  AdminComplianceRoutesContainer
>;

type _UserSliceContract = [
  _UserAccountFromContainer,
  _UserAccountMustNotSeeFinance,
  _UserAccountMustNotSeeComplianceAdmin,
];

defineCompileTimeContract<_UserSliceContract>();

describe("user route container slices", () => {
  it("compile-time slice contracts are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
