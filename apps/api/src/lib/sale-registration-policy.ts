import type { LegalEntitySummary } from "@auction/types";

export type EntityMemberRole = LegalEntitySummary["role"];

/** Single rule reused by eligibility, registration request, and UI. */
export function memberRequiresSaleRegistration(role: EntityMemberRole | undefined | null): boolean {
  return role === "buyer_agent";
}
