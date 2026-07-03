import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { BidService } from "../bid.service.js";
import type { IBidPlacer, IBidPlacerWithIdempotency } from "../interfaces/place-bid.js";

/**
 * Compile-time LSP contract: BidService facade must remain substitutable for
 * segregated bid placement interfaces.
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: BidService;

type _Placer = AssertAssignable<typeof facade, IBidPlacer>;
type _PlacerWithIdempotency = AssertAssignable<typeof facade, IBidPlacerWithIdempotency>;

type _FacadeContract = [_Placer, _PlacerWithIdempotency];

defineCompileTimeContract<_FacadeContract>();

describe("BidService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
