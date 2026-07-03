import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { AmlService } from "./aml.service.js";
import type {
  IAmlMonitoringService,
  IAmlReviewApplicationService,
  IAmlService,
  IAmlWebhookIngestService,
} from "./ports.js";

/**
 * Compile-time LSP contract: the migration facade must remain substitutable for
 * every segregated interface (identical public method surface at the type level).
 */
type AssertAssignable<T extends U, U> = T;

declare const facade: AmlService;

type _Composite = AssertAssignable<typeof facade, IAmlService>;
type _Ingest = AssertAssignable<typeof facade, IAmlWebhookIngestService>;
type _Review = AssertAssignable<typeof facade, IAmlReviewApplicationService>;
type _Monitoring = AssertAssignable<typeof facade, IAmlMonitoringService>;

type _FacadeContract = [_Composite, _Ingest, _Review, _Monitoring];

defineCompileTimeContract<_FacadeContract>();

describe("AmlService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
