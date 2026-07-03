import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type {
  ISourceOfFundsDocumentCollectionBuyerService,
  ISourceOfFundsDocumentCollectionService,
  ISourceOfFundsDocumentCollectionStaffService,
} from "../interfaces/source-of-funds-document-collection.js";
import type { SourceOfFundsDocumentCollectionService } from "./source-of-funds-document-collection.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: SourceOfFundsDocumentCollectionService;

type _Composite = AssertAssignable<typeof facade, ISourceOfFundsDocumentCollectionService>;
type _Buyer = AssertAssignable<typeof facade, ISourceOfFundsDocumentCollectionBuyerService>;
type _Staff = AssertAssignable<typeof facade, ISourceOfFundsDocumentCollectionStaffService>;

type _FacadeContract = [_Composite, _Buyer, _Staff];

defineCompileTimeContract<_FacadeContract>();

describe("SourceOfFundsDocumentCollectionService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
