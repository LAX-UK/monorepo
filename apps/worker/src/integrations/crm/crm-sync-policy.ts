import type { CrmRecordLinkRow } from "@auction/persistence/interfaces";
import type { CrmSearchByEmailResult } from "./crm-gateway.js";
import { isRealZohoLink } from "./crm-tombstone.js";

export type CrmPersonMatch =
  | { kind: "link"; link: CrmRecordLinkRow }
  | { kind: "email"; match: CrmSearchByEmailResult }
  | { kind: "create_lead" };

/** Pure matching order: link row, then email lookup, then create Lead. */
export function resolvePersonMatch(input: {
  subjectId: string;
  link: CrmRecordLinkRow | null;
  emailMatch: CrmSearchByEmailResult;
  erased: boolean;
}): CrmPersonMatch | { kind: "blocked"; reason: string } {
  if (input.erased) {
    return { kind: "blocked", reason: "subject_erased" };
  }
  if (
    input.link &&
    !input.link.erasedAt &&
    isRealZohoLink(input.link.zohoModule, input.link.zohoRecordId)
  ) {
    return { kind: "link", link: input.link };
  }
  if (input.emailMatch) {
    return { kind: "email", match: input.emailMatch };
  }
  return { kind: "create_lead" };
}

export function evaluatePersonPatch(input: {
  mode: "upsert" | "patch";
  link: CrmRecordLinkRow | null;
}): { allowed: true } | { allowed: false; reason: "person_not_linked"; retryable: true } {
  if (input.mode !== "patch") return { allowed: true };
  if (
    input.link &&
    !input.link.erasedAt &&
    isRealZohoLink(input.link.zohoModule, input.link.zohoRecordId)
  ) {
    return { allowed: true };
  }
  return { allowed: false, reason: "person_not_linked", retryable: true };
}

export function shouldLookupPersonByEmail(link: CrmRecordLinkRow | null): boolean {
  if (!link || link.erasedAt) return true;
  return !isRealZohoLink(link.zohoModule, link.zohoRecordId);
}

export function formatProviderReference(result: {
  module: string;
  recordId: string;
  action: string;
}): string {
  return `${result.module}:${result.recordId}:${result.action}`;
}
