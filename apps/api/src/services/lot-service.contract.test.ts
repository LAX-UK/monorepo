import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  ILotLifecycleService,
  ILotReadService,
  ILotService,
  ILotWriteService,
} from "./interfaces/lot-service.js";
import type { LotService } from "./lot.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: LotService;

type _Composite = AssertAssignable<typeof facade, ILotService>;
type _Read = AssertAssignable<typeof facade, ILotReadService>;
type _Write = AssertAssignable<typeof facade, ILotWriteService>;
type _Lifecycle = AssertAssignable<typeof facade, ILotLifecycleService>;

type _FacadeContract = [_Composite, _Read, _Write, _Lifecycle];

defineCompileTimeContract<_FacadeContract>();

describe("LotService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
