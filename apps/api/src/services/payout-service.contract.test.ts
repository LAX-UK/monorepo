import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  IPayoutAdminService,
  IPayoutMaintenanceService,
  IPayoutSellerService,
  IPayoutService,
  IPayoutSettlementService,
} from "./interfaces/payout.js";
import type { PayoutService } from "./payout.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: PayoutService;

type _Composite = AssertAssignable<typeof facade, IPayoutService>;
type _Seller = AssertAssignable<typeof facade, IPayoutSellerService>;
type _Admin = AssertAssignable<typeof facade, IPayoutAdminService>;
type _Settlement = AssertAssignable<typeof facade, IPayoutSettlementService>;
type _Maintenance = AssertAssignable<typeof facade, IPayoutMaintenanceService>;

type _FacadeContract = [_Composite, _Seller, _Admin, _Settlement, _Maintenance];

defineCompileTimeContract<_FacadeContract>();

describe("PayoutService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
