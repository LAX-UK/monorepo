import type { Env } from "../env.js";

export function rejectFinanceCronWhenDelegatedToWorker(
  env: Pick<Env, "FINANCE_CRON_EXECUTION_OWNER">,
):
  | { ok: true }
  | { ok: false; status: 409; body: { error: "finance_cron_execution_delegated_to_worker" } } {
  if (env.FINANCE_CRON_EXECUTION_OWNER === "worker") {
    return {
      ok: false,
      status: 409,
      body: { error: "finance_cron_execution_delegated_to_worker" },
    };
  }
  return { ok: true };
}
