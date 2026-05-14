import type { StepUpActionResult } from "./types";
import type { IStepUpCoordinator } from "./use-step-up-coordinator";

/**
 * Runs a sensitive action once; on step-up failure, asks the coordinator to satisfy it,
 * then retries at most once.
 */
export async function withStepUp<T>(
  action: () => Promise<StepUpActionResult<T>>,
  coordinator: IStepUpCoordinator,
): Promise<StepUpActionResult<T>> {
  const first = await action();
  if (first.ok) return first;
  if (first.reason !== "recent_auth_required" && first.reason !== "credential_required") {
    return first;
  }
  const gate = await coordinator.request(first.reason);
  if (gate === "cancelled") return first;
  return action();
}
