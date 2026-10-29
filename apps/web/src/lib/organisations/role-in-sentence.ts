import { roleLabel } from "@/lib/organisations/legal-entity-labels";
import type { LegalEntityMemberRole } from "@auction/types";

/**
 * Each member role as it reads mid-sentence, with its article: "as a buyer agent", "you're an
 * admin". Labels ("Buyer agent") stay for badges and pickers; sentences use these.
 */
const ROLE_IN_SENTENCE: Record<LegalEntityMemberRole, string> = {
  owner: "an owner",
  admin: "an admin",
  consignor: "a consignor",
  finance: "a finance member",
  buyer_agent: "a buyer agent",
  viewer: "a viewer",
};

export function roleInSentence(role: LegalEntityMemberRole | string): string {
  if (role in ROLE_IN_SENTENCE) return ROLE_IN_SENTENCE[role as LegalEntityMemberRole];
  const words = roleLabel(role).toLowerCase();
  return `${/^[aeiou]/.test(words) ? "an" : "a"} ${words}`;
}
