import { describe, expect, it } from "vitest";
import type { Container } from "../../container.js";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { AdminComplianceRoutesContainer } from "../interfaces/admin-routes/admin-route-container-slices.js";
import type { FinancePayoutStatementRoutesContainer } from "../interfaces/finance-routes/finance-route-container-slices.js";
import type {
  IdentityAuthRoutesContainer,
  IdentityLegalEntityMemberRoutesContainer,
  IdentityLegalEntityRoutesContainer,
  IdentityOrganizationRoutesContainer,
} from "../interfaces/identity-routes/identity-route-container-slices.js";

type AssertAssignable<T extends U, U> = T;
type AssertNotAssignable<T, U> = T extends U ? never : T;

declare const container: Container;

type _AuthFromContainer = AssertAssignable<Container, IdentityAuthRoutesContainer>;
type _AuthMustNotSeeFinance = AssertNotAssignable<
  IdentityAuthRoutesContainer,
  FinancePayoutStatementRoutesContainer
>;
type _LegalEntityFromContainer = AssertAssignable<Container, IdentityLegalEntityRoutesContainer>;
type _LegalEntityMustNotSeeComplianceAdmin = AssertNotAssignable<
  IdentityLegalEntityRoutesContainer,
  AdminComplianceRoutesContainer
>;
type _MemberFromContainer = AssertAssignable<Container, IdentityLegalEntityMemberRoutesContainer>;
type _OrganizationFromContainer = AssertAssignable<Container, IdentityOrganizationRoutesContainer>;

type _IdentitySliceContract = [
  _AuthFromContainer,
  _AuthMustNotSeeFinance,
  _LegalEntityFromContainer,
  _LegalEntityMustNotSeeComplianceAdmin,
  _MemberFromContainer,
  _OrganizationFromContainer,
];

defineCompileTimeContract<_IdentitySliceContract>();

describe("identity route container slices", () => {
  it("compile-time slice contracts are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
