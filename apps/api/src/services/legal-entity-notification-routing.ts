import type {
  ILegalEntityNotificationRecipientReader,
  LegalEntityNotificationAudience,
} from "@auction/persistence";

export async function resolveLegalEntityNotificationRecipients(
  reader: ILegalEntityNotificationRecipientReader | null,
  args: {
    legalEntityId?: string | null | undefined;
    fallbackUserId: string;
    audience: LegalEntityNotificationAudience;
  },
): Promise<string[]> {
  if (reader && args.legalEntityId) {
    const recipients = await reader.listUserIdsForAudience(args.legalEntityId, args.audience);
    if (recipients.length > 0) return [...new Set(recipients)];
  }

  return [args.fallbackUserId];
}
