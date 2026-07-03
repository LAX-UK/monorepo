import type { EmailSuppressionReason } from "@auction/db/schema";

export interface IEmailSuppressionRepository {
  upsert(emailHash: string, reason: EmailSuppressionReason): Promise<void>;
}
