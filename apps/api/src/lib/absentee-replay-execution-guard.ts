import type { Env } from "../env.js";

export function rejectAbsenteeReplayWhenDelegatedToWorker(
  env: Pick<Env, "ABSENTEE_REPLAY_OWNER">,
):
  | { ok: true }
  | { ok: false; status: 409; body: { error: "absentee_replay_delegated_to_worker" } } {
  if (env.ABSENTEE_REPLAY_OWNER === "worker") {
    return {
      ok: false,
      status: 409,
      body: { error: "absentee_replay_delegated_to_worker" },
    };
  }
  return { ok: true };
}
