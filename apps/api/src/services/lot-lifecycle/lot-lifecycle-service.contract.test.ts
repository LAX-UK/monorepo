import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { LotLifecycleService } from "../lot-lifecycle.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: LotLifecycleService;

type _RunTransitions = AssertAssignable<
  (typeof facade)["runTransitions"],
  (now?: Date) => Promise<void>
>;
type _RunDutch = AssertAssignable<
  (typeof facade)["runDutchDecrements"],
  (now?: Date) => Promise<void>
>;
type _ClerkHammer = AssertAssignable<
  (typeof facade)["finalizeActiveLotFromClerkHammer"],
  (lotId: string) => Promise<{ winnerId: string | null; voided: boolean } | null>
>;
type _ClerkNoSale = AssertAssignable<
  (typeof facade)["noSaleEndActiveLotFromClerk"],
  (lotId: string) => Promise<boolean>
>;
type _FinalizeSale = AssertAssignable<
  (typeof facade)["finalizeActiveLotsPastEnd"],
  (saleId: string, now?: Date) => Promise<number>
>;
type _ActivateJob = AssertAssignable<
  (typeof facade)["processActivateJob"],
  (lotId: string, now?: Date) => Promise<void>
>;
type _EndJob = AssertAssignable<
  (typeof facade)["processEndJob"],
  (lotId: string, now?: Date) => Promise<void>
>;

type _FacadeContract = [
  _RunTransitions,
  _RunDutch,
  _ClerkHammer,
  _ClerkNoSale,
  _FinalizeSale,
  _ActivateJob,
  _EndJob,
];

defineCompileTimeContract<_FacadeContract>();

describe("LotLifecycleService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
