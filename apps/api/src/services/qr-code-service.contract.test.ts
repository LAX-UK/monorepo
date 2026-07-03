import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type {
  IQrCodeAdminService,
  IQrCodePublicResolveService,
  IQrCodeService,
} from "./interfaces/qr-code-service.js";
import type { QrCodeService } from "./qr-code.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: QrCodeService;

type _Composite = AssertAssignable<typeof facade, IQrCodeService>;
type _Admin = AssertAssignable<typeof facade, IQrCodeAdminService>;
type _Public = AssertAssignable<typeof facade, IQrCodePublicResolveService>;

type _FacadeContract = [_Composite, _Admin, _Public];

defineCompileTimeContract<_FacadeContract>();

describe("QrCodeService facade contract", () => {
  it("compile-time LSP types are checked for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
