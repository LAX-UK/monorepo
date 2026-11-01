import { replyNoticeSweepCutoff } from "@auction/domain";
import type { IConsignmentMessageRepository } from "@auction/persistence/interfaces";

/** The most replies one sweep sends; the next run takes the rest. */
export const REPLY_SWEEP_BATCH = 200;

export type ConsignmentThreadSweepResult = { repliesNotified: number; coversEnded: number };

export type ConsignmentThreadSweepDeps = {
  messages: Pick<IConsignmentMessageRepository, "listOverdueReplyNotices">;
  /** Tells the account about one reply, once; false when it was told already or taken back. */
  deliver(messageId: string): Promise<boolean>;
  assignment: { endElapsedCovers(): Promise<number> };
  onError?: (message: string, error: unknown) => void;
  now?: () => Date;
};

/**
 * The safety net behind two timed promises: a staff reply tells the account once its hold ends
 * (even if the delivery job was lost with the queue), and a cover goes back to the specialist on
 * its end date. Both steps are safe to repeat and to run at once.
 */
export class ConsignmentThreadSweepService {
  private readonly now: () => Date;

  constructor(private readonly deps: ConsignmentThreadSweepDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async sweep(): Promise<ConsignmentThreadSweepResult> {
    const repliesNotified = await this.notifyOverdueReplies();
    const coversEnded = await this.deps.assignment.endElapsedCovers();
    return { repliesNotified, coversEnded };
  }

  private async notifyOverdueReplies(): Promise<number> {
    const ids = await this.deps.messages.listOverdueReplyNotices(
      replyNoticeSweepCutoff(this.now()),
      REPLY_SWEEP_BATCH,
    );
    let notified = 0;
    for (const messageId of ids) {
      try {
        if (await this.deps.deliver(messageId)) notified++;
      } catch (error) {
        // One failing reply must not hold back the others; the next sweep tries it again.
        this.deps.onError?.("consignment reply notice failed in the sweep", error);
      }
    }
    return notified;
  }
}
