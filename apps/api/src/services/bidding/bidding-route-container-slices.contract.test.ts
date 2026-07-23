import { describe, expect, it } from "vitest";
import type { Container } from "../../container.js";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { AdminComplianceRoutesContainer } from "../interfaces/admin-routes/admin-route-container-slices.js";
import type {
  BiddingLotParticipationRoutesContainer,
  BiddingPlaceBidRoutesContainer,
  BiddingSaleRegistrationRoutesContainer,
  BiddingSaleroomAdminRoutesContainer,
} from "../interfaces/bidding-routes/bidding-route-container-slices.js";
import type { FinancePayoutStatementRoutesContainer } from "../interfaces/finance-routes/finance-route-container-slices.js";

type AssertAssignable<T extends U, U> = T;
type AssertNotAssignable<T, U> = T extends U ? never : T;

declare const container: Container;

type _PlaceBidFromContainer = AssertAssignable<Container, BiddingPlaceBidRoutesContainer>;
type _PlaceBidMustNotSeeFinance = AssertNotAssignable<
  BiddingPlaceBidRoutesContainer,
  FinancePayoutStatementRoutesContainer
>;
type _LotParticipationFromContainer = AssertAssignable<
  Container,
  BiddingLotParticipationRoutesContainer
>;
type _LotParticipationMustNotSeeComplianceAdmin = AssertNotAssignable<
  BiddingLotParticipationRoutesContainer,
  AdminComplianceRoutesContainer
>;
type _SaleRegistrationFromContainer = AssertAssignable<
  Container,
  BiddingSaleRegistrationRoutesContainer
>;
type _SaleroomAdminMustNotUseBiddingRoutes = AssertNotAssignable<
  BiddingPlaceBidRoutesContainer,
  BiddingSaleroomAdminRoutesContainer
>;

type _BiddingSliceContract = [
  _PlaceBidFromContainer,
  _PlaceBidMustNotSeeFinance,
  _LotParticipationFromContainer,
  _LotParticipationMustNotSeeComplianceAdmin,
  _SaleRegistrationFromContainer,
  _SaleroomAdminMustNotUseBiddingRoutes,
];

defineCompileTimeContract<_BiddingSliceContract>();

describe("bidding route container slices", () => {
  it("compile-time slice contracts are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
