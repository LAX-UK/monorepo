import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../testing/compile-time-contract.js";
import type { ILotLifecycleRecorder } from "./interfaces/lot-lifecycle-recorder.js";
import type { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";

type AssertAssignable<T extends U, U> = T;

declare const recorder: LotLifecycleRecording;

type _RecorderPort = AssertAssignable<typeof recorder, ILotLifecycleRecorder>;

type _FacadeContract = [_RecorderPort];

defineCompileTimeContract<_FacadeContract>();

describe("LotLifecycleRecording port contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
