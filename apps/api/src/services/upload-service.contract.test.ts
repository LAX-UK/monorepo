import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { IUploadService } from "./interfaces/upload-service.js";
import type { UploadService } from "./upload.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * the composite upload port (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: UploadService;

type _Composite = AssertAssignable<typeof facade, IUploadService>;

type _FacadeContract = [_Composite];

defineCompileTimeContract<_FacadeContract>();

describe("UploadService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
