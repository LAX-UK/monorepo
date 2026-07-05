import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  IPaymentAdminService,
  IPaymentBuyerService,
  IPaymentMaintenanceService,
} from "./interfaces/payment-service.js";
import type { PaymentService } from "./payment.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: PaymentService;

type _Buyer = AssertAssignable<typeof facade, IPaymentBuyerService>;
type _Admin = AssertAssignable<typeof facade, IPaymentAdminService>;
type _Maintenance = AssertAssignable<typeof facade, IPaymentMaintenanceService>;

type _FacadeContract = [_Buyer, _Admin, _Maintenance];

defineCompileTimeContract<_FacadeContract>();

describe("PaymentService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
