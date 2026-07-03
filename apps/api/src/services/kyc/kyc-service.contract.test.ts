import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { IKycService } from "../interfaces/kyc-service.js";
import type { IKycGateService, IKycSessionService, IKycWebhookIngestService } from "./ports.js";
import type { VeriffKycService } from "./veriff-kyc.service.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: VeriffKycService;

type _Composite = AssertAssignable<typeof facade, IKycService>;
type _Session = AssertAssignable<typeof facade, IKycSessionService>;
type _Ingest = AssertAssignable<typeof facade, IKycWebhookIngestService>;
type _Gate = AssertAssignable<typeof facade, IKycGateService>;

type _FacadeContract = [_Composite, _Session, _Ingest, _Gate];

defineCompileTimeContract<_FacadeContract>();

describe("VeriffKycService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
