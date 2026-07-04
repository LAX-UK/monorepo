import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  IItemSubmissionAdminApi,
  IItemSubmissionSellerApi,
  IItemSubmissionService,
} from "./interfaces/item-submission-apis.js";
import type { ItemSubmissionService } from "./item-submission.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: ItemSubmissionService;

type _Composite = AssertAssignable<typeof facade, IItemSubmissionService>;
type _Seller = AssertAssignable<typeof facade, IItemSubmissionSellerApi>;
type _Admin = AssertAssignable<typeof facade, IItemSubmissionAdminApi>;

type _FacadeContract = [_Composite, _Seller, _Admin];

defineCompileTimeContract<_FacadeContract>();

describe("ItemSubmissionService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
