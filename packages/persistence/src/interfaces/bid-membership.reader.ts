import type { LegalEntityMemberRole } from "@auction/types";

export interface IBidMembershipReader {
  findActiveMemberRole(
    userId: string,
    legalEntityId: string,
  ): Promise<LegalEntityMemberRole | null>;
}
