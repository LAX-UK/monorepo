import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  ISaleLifecycleService,
  ISaleLotMembershipService,
  ISaleReadService,
  ISaleService,
  ISaleWriteService,
} from "./interfaces/sale-service.js";
import type { SaleService } from "./sale.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: SaleService;

type _Composite = AssertAssignable<typeof facade, ISaleService>;
type _Read = AssertAssignable<typeof facade, ISaleReadService>;
type _Write = AssertAssignable<typeof facade, ISaleWriteService>;
type _Lifecycle = AssertAssignable<typeof facade, ISaleLifecycleService>;
type _Membership = AssertAssignable<typeof facade, ISaleLotMembershipService>;

type _FacadeContract = [_Composite, _Read, _Write, _Lifecycle, _Membership];

defineCompileTimeContract<_FacadeContract>();

describe("SaleService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
