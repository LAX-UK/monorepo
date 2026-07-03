import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { IInvitationLifecycleService } from "../interfaces/invitation-lifecycle.js";
import type { InvitationLifecycleService } from "../invitation-lifecycle.service.js";

type AssertAssignable<T extends U, U> = T;

declare const facade: InvitationLifecycleService;

type _Lifecycle = AssertAssignable<typeof facade, IInvitationLifecycleService>;

type _FacadeContract = [_Lifecycle];

defineCompileTimeContract<_FacadeContract>();

describe("InvitationLifecycleService facade contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
