import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  ISaleroomDisplayControlService,
  ISaleroomService,
  ISaleroomSessionControlService,
  ISaleroomSessionReadService,
} from "./interfaces/saleroom-service.js";
import type { SaleroomService } from "./saleroom.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: SaleroomService;

type _Composite = AssertAssignable<typeof facade, ISaleroomService>;
type _Read = AssertAssignable<typeof facade, ISaleroomSessionReadService>;
type _Control = AssertAssignable<typeof facade, ISaleroomSessionControlService>;
type _Display = AssertAssignable<typeof facade, ISaleroomDisplayControlService>;

type _FacadeContract = [_Composite, _Read, _Control, _Display];

defineCompileTimeContract<_FacadeContract>();

describe("SaleroomService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
