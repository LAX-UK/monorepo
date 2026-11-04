import type { AccountEnableOutcome, SubscribeService, SubscriberStore } from "@auction/alerts";

export const FOLLOW_ALERT_SOURCE = "art_follow";

type FollowLogger = { warn(fields: Record<string, unknown>, message: string): void };

/**
 * Following an artist on lax.art switches on emails about their new work, for a signed-in person
 * with a verified address: they were told "Follow this artist to hear when new works arrive".
 * Following again after stopping the emails switches them back on, because pressing Follow is the
 * person asking. A follow that already existed is left as the person set it.
 */
export class FollowAlertsService {
  constructor(
    private readonly deps: {
      subscribe: Pick<SubscribeService, "enableForAccount">;
      subscribers: Pick<SubscriberStore, "findBySubject">;
      log: FollowLogger;
    },
  ) {}

  /** Never throws: the follow itself has already been saved, and alerts must not undo it. */
  async onFollowed(subjectId: string, outcome: "followed" | "already_followed"): Promise<void> {
    try {
      if (outcome === "already_followed") {
        if (await this.deps.subscribers.findBySubject("art", subjectId)) return;
      }
      await this.switchOn(subjectId);
    } catch (err) {
      this.deps.log.warn({ err }, "could not switch on emails for a followed artist");
    }
  }

  private switchOn(subjectId: string): Promise<AccountEnableOutcome> {
    return this.deps.subscribe.enableForAccount({
      product: "art",
      subjectId,
      topic: "art.followed_artists",
      source: FOLLOW_ALERT_SOURCE,
    });
  }
}
