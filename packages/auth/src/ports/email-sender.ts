/** Identity-owned email port; mirrors @auction/email IEmailService without that dependency. */

export type EmailCategory = "auth" | "transactional";
export type EmailStream = "transactional" | "broadcast";

export type EmailEnqueueInput = {
  template: string;
  to: string;
  userId?: string;
  vars: Record<string, unknown>;
  stream?: EmailStream;
  idempotencyKey?: string;
  category: EmailCategory;
};

export type EmailSender = {
  enqueue(input: EmailEnqueueInput): Promise<{ outboxId: string }>;
};
