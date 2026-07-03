import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { ILotStatusAdminService } from "./interfaces/lot-status-admin.js";
import type { ISaleStatusTransitionService } from "./interfaces/sale-status-transition.js";
import type { LotStatusAdminService } from "./lot-status-admin.service.js";
import type { SaleStatusTransitionService } from "./sale-status-transition.service.js";

type AssertAssignable<T extends U, U> = T;

declare const transitionFacade: SaleStatusTransitionService;
declare const lotAdminFacade: LotStatusAdminService;

type _Transition = AssertAssignable<typeof transitionFacade, ISaleStatusTransitionService>;
type _LotAdmin = AssertAssignable<typeof lotAdminFacade, ILotStatusAdminService>;

type _FacadeContract = [_Transition, _LotAdmin];

defineCompileTimeContract<_FacadeContract>();

describe("Sale status transition facade contracts", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
