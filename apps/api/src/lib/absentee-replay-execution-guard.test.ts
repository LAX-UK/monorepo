import { describe, expect, it } from "vitest";
import { rejectAbsenteeReplayWhenDelegatedToWorker } from "./absentee-replay-execution-guard.js";

describe("rejectAbsenteeReplayWhenDelegatedToWorker", () => {
  it("allows replay when owner is api_rollback", () => {
    expect(
      rejectAbsenteeReplayWhenDelegatedToWorker({ ABSENTEE_REPLAY_OWNER: "api_rollback" }),
    ).toEqual({ ok: true });
  });

  it("returns 409 when worker owns absentee replay", () => {
    expect(rejectAbsenteeReplayWhenDelegatedToWorker({ ABSENTEE_REPLAY_OWNER: "worker" })).toEqual({
      ok: false,
      status: 409,
      body: { error: "absentee_replay_delegated_to_worker" },
    });
  });
});
