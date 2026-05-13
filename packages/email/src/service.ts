import type { RecipientResolution, TemplateName, TemplateVarsByName } from "./types.js";

export type EmailCategory = "auth" | "transactional";
export type EmailStream = "transactional" | "broadcast";

export type EmailEnqueueInput<T extends TemplateName = TemplateName> = {
  template: T;
  to: string;
  userId?: string;
  /** When set, overrides {@link RECIPIENT_RESOLUTION} for this row (e.g. ops inbox without `userId`). */
  recipientResolution?: RecipientResolution;
  vars: TemplateVarsByName[T];
  stream?: EmailStream;
  idempotencyKey?: string;
  category: EmailCategory;
};

export interface IEmailService {
  enqueue<T extends TemplateName>(input: EmailEnqueueInput<T>): Promise<{ outboxId: string }>;
}

export type EmailSenderPayload<T extends TemplateName = TemplateName> = {
  outboxId: string;
  template: T;
  to: string;
  vars: TemplateVarsByName[T];
  stream: EmailStream;
  flaggedAddress: boolean;
  userId?: string | null;
  unsubscribeUrl?: string | null;
};

export interface IEmailSender {
  send<T extends TemplateName>(payload: EmailSenderPayload<T>): Promise<{ messageId: string }>;
}
