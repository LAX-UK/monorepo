/** Inline image referenced from HTML as `cid:<contentId>`. */
export type TransactionalMailInlineAttachment = {
  contentId: string;
  filename: string;
  contentType: string;
  contentBase64: string;
};

/** Primitive outbound mail payload (OCP: new notification kinds extend callers, not this shape). */
export type TransactionalMailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  inlineAttachments?: TransactionalMailInlineAttachment[];
  meta?: Record<string, unknown>;
};

export interface ITransactionalMailer {
  send(input: TransactionalMailPayload): Promise<void>;
}
