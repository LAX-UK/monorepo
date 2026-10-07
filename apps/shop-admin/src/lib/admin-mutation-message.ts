import type { AdminMutationResult } from "@/server/application/admin-mutation-result";

export function adminMutationErrorMessage(
  result: Exclude<AdminMutationResult<unknown>, { ok: true }>,
): string {
  switch (result.kind) {
    case "unauthorized":
      return "Session expired. Sign in again.";
    case "forbidden":
      return "You do not have permission for this action.";
    case "csrf":
      return "Security check failed. Refresh the page and try again.";
    case "step_up_required":
      return result.message;
    case "conflict":
    case "validation":
    case "failed":
      return result.message;
    default:
      return "Action failed.";
  }
}
