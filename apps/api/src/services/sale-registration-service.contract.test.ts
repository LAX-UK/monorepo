import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  ISaleRegistrationAdminService,
  ISaleRegistrationBuyerService,
  ISaleRegistrationService,
} from "./interfaces/sale-registration-service.js";
import type { SaleRegistrationService } from "./sale-registration.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: SaleRegistrationService;

type _Composite = AssertAssignable<typeof facade, ISaleRegistrationService>;
type _Buyer = AssertAssignable<typeof facade, ISaleRegistrationBuyerService>;
type _Admin = AssertAssignable<typeof facade, ISaleRegistrationAdminService>;

type _FacadeContract = [_Composite, _Buyer, _Admin];

defineCompileTimeContract<_FacadeContract>();

describe("SaleRegistrationService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
