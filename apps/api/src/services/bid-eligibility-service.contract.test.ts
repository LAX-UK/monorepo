import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { BidEligibilityService } from "./bid-eligibility.service.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: BidEligibilityService;

type _Eligibility = AssertAssignable<typeof facade, IBidEligibility>;

type _FacadeContract = [_Eligibility];

defineCompileTimeContract<_FacadeContract>();

describe("BidEligibilityService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
