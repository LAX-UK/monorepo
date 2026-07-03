import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { ISalePublishService } from "../interfaces/sale-publish.js";
import type { SalePublishService } from "./sale-publish.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: SalePublishService;

type _Publish = AssertAssignable<typeof facade, ISalePublishService>;

type _FacadeContract = [_Publish];

defineCompileTimeContract<_FacadeContract>();

describe("SalePublishService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
