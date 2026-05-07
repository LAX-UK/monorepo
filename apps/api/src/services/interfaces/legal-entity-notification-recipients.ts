import type { LegalEntityMemberRole } from "@auction/types";

export type LegalEntityNotificationAudience = "seller" | "finance" | "admin";

export interface ILegalEntityNotificationRecipientReader {
  listUserIdsForAudience(
    legalEntityId: string,
    audience: LegalEntityNotificationAudience,
  ): Promise<string[]>;
}

export const legalEntityNotificationAudienceRoles = {
  seller: ["owner", "admin", "consignor"],
  finance: ["owner", "admin", "finance"],
  admin: ["owner", "admin"],
} as const satisfies Record<LegalEntityNotificationAudience, readonly LegalEntityMemberRole[]>;
