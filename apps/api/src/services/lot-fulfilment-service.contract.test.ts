import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  ILotFulfilmentAdminService,
  ILotFulfilmentBuyerService,
  ILotFulfilmentPaymentSyncService,
  ILotFulfilmentService,
} from "./interfaces/lot-fulfilment-service.js";
import type { LotFulfilmentService } from "./lot-fulfilment.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: LotFulfilmentService;

type _Composite = AssertAssignable<typeof facade, ILotFulfilmentService>;
type _Buyer = AssertAssignable<typeof facade, ILotFulfilmentBuyerService>;
type _Admin = AssertAssignable<typeof facade, ILotFulfilmentAdminService>;
type _PaymentSync = AssertAssignable<typeof facade, ILotFulfilmentPaymentSyncService>;

type _FacadeContract = [_Composite, _Buyer, _Admin, _PaymentSync];

defineCompileTimeContract<_FacadeContract>();

describe("LotFulfilmentService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
