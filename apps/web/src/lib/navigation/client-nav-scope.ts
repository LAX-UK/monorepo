import type { LegalEntitySummary } from "@auction/types";
import type { ClientNavScope } from "./client-nav-model";

/**
 * The navigation scope for the account in use: an organisation the person acts for, or their
 * own account. Only a personal account's submissions open its Selling pages.
 */
export function clientNavScopeFor(
  acting: Pick<LegalEntitySummary, "kind" | "id" | "role"> | null,
  hasPersonalSubmissions: boolean,
): ClientNavScope {
  if (acting?.kind === "organisation") {
    return {
      context: { kind: "organisation", id: acting.id, role: acting.role },
      hasSubmissions: false,
    };
  }
  return { context: { kind: "personal" }, hasSubmissions: hasPersonalSubmissions };
}
