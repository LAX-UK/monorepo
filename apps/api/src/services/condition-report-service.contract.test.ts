import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { ConditionReportService } from "./condition-report.service.js";
import type {
  IConditionReportAdminService,
  IConditionReportBuyerService,
  IConditionReportFulfilmentService,
  IConditionReportService,
} from "./interfaces/condition-report.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: ConditionReportService;

type _Composite = AssertAssignable<typeof facade, IConditionReportService>;
type _Buyer = AssertAssignable<typeof facade, IConditionReportBuyerService>;
type _Admin = AssertAssignable<typeof facade, IConditionReportAdminService>;
type _Fulfilment = AssertAssignable<typeof facade, IConditionReportFulfilmentService>;

type _FacadeContract = [_Composite, _Buyer, _Admin, _Fulfilment];

defineCompileTimeContract<_FacadeContract>();

describe("ConditionReportService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
