import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import { adminMutationErrorMessage } from "./admin-mutation-message";

/** Upstream 5xx bodies may carry raw database text, so failures get fixed copy. */
export function editorialMutationErrorMessage(
  result: Exclude<AdminMutationResult<unknown>, { ok: true }>,
  action: string,
): string {
  switch (result.kind) {
    case "validation":
      return `Could not ${action}: the server rejected some fields. Check the form and try again.`;
    case "conflict":
      return `Could not ${action}: that slug is already in use. Choose a different slug.`;
    case "failed":
      return `Could not ${action}. The service is unavailable. Try again.`;
    default:
      return adminMutationErrorMessage(result);
  }
}
