import type { LegalEntityMemberRole } from "@auction/types";
import type { OwnerContact } from "../interfaces/identity-routes/identity-legal-entity-member-http.js";

type MemberLike = {
  role: LegalEntityMemberRole;
  isPrimaryAdmin: boolean;
  acceptedAt: Date | null;
  removedAt: Date | null;
  user: { name: string; email: string };
};

/**
 * The owners a member can ask for access ("Need access? Ask an owner: Maya Okafor"): active
 * owners only, the primary owner first, each by name. A member without a name is named by the
 * part of their email before the @, so the line never shows a full address to other members.
 */
export function ownerContacts(members: readonly MemberLike[]): OwnerContact[] {
  return members
    .filter((m) => m.role === "owner" && m.acceptedAt !== null && m.removedAt === null)
    .sort((a, b) => Number(b.isPrimaryAdmin) - Number(a.isPrimaryAdmin))
    .map((m) => ({ name: m.user.name.trim() || (m.user.email.split("@")[0] ?? "An owner") }));
}
