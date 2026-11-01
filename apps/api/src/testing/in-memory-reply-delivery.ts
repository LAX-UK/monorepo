import type { IConsignmentReplyDelivery } from "../services/consignment-messages/consignment-message.ports.js";

/** The reply delivery queue in memory: what is scheduled, and a way to make it fail. */
export class InMemoryReplyDelivery implements IConsignmentReplyDelivery {
  readonly scheduled = new Map<string, Date>();
  failScheduling = false;

  async schedule(messageId: string, at: Date): Promise<void> {
    if (this.failScheduling) throw new Error("queue is away");
    this.scheduled.set(messageId, at);
  }

  async cancel(messageId: string): Promise<void> {
    this.scheduled.delete(messageId);
  }
}
