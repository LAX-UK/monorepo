/** Primitive outbound mail payload (OCP: new notification kinds extend callers, not this shape). */
export type TransactionalMailPayload = {
  to: string;
  subject: string;
  text: string;
  meta?: Record<string, unknown>;
};

export interface ITransactionalMailer {
  send(input: TransactionalMailPayload): Promise<void>;
}
