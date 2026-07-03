import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { ISourceOfFundsGate } from "../aml/settlement-compliance.policy.js";
import type {
  ISourceOfFundsGateService,
  ISourceOfFundsReviewService,
  ISourceOfFundsService,
} from "../interfaces/source-of-funds-service.js";
import type { SourceOfFundsService } from "./source-of-funds.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: SourceOfFundsService;

type _Composite = AssertAssignable<typeof facade, ISourceOfFundsService>;
type _Gate = AssertAssignable<typeof facade, ISourceOfFundsGateService>;
type _Review = AssertAssignable<typeof facade, ISourceOfFundsReviewService>;
type _SettlementGate = AssertAssignable<typeof facade, ISourceOfFundsGate>;

type _FacadeContract = [_Composite, _Gate, _Review, _SettlementGate];

defineCompileTimeContract<_FacadeContract>();

describe("SourceOfFundsService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
