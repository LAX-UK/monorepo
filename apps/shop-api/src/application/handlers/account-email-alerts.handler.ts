import { type AlertProduct, type PreferencesService, productOfTopic } from "@auction/alerts";
import {
  ACCOUNT_EMAIL_ALERT_TOPICS,
  type AccountEmailAlertRefusal,
  type AccountEmailAlertTopic,
  type AccountEmailAlerts,
} from "@auction/shop-contracts";

export type AccountEmailAlertDeps = {
  preferences: Pick<PreferencesService, "view" | "setTopic">;
  /** The editions the person asked to hear about and is still waiting for. */
  countWaitingEditions: (identitySubjectId: string) => Promise<number>;
};

/**
 * A signed-in person's own alert switches across LAX Shop and lax.art, read and written through
 * the same rows the links in alert emails use.
 */
export function createAccountEmailAlertHandlers(deps: AccountEmailAlertDeps) {
  return {
    async view(identitySubjectId: string): Promise<AccountEmailAlerts> {
      const products = [
        ...new Set(ACCOUNT_EMAIL_ALERT_TOPICS.map((topic) => productOfTopic(topic))),
      ] as AlertProduct[];
      const views = new Map(
        await Promise.all(
          products.map(
            async (product) =>
              [product, await deps.preferences.view(product, identitySubjectId)] as const,
          ),
        ),
      );
      const topics = ACCOUNT_EMAIL_ALERT_TOPICS.map((topic) => {
        const view = views.get(productOfTopic(topic));
        const emailOn =
          view?.state === "confirmed" &&
          view.topics.some((entry) => entry.topic === topic && entry.emailOn);
        return { topic, emailOn };
      });
      return { topics, waitingEditions: await deps.countWaitingEditions(identitySubjectId) };
    },

    /** Null when saved; otherwise why the topic could not be switched on. */
    async setTopic(input: {
      identitySubjectId: string;
      topic: AccountEmailAlertTopic;
      on: boolean;
    }): Promise<AccountEmailAlertRefusal["reason"] | null> {
      const outcome = await deps.preferences.setTopic({
        product: productOfTopic(input.topic),
        subjectId: input.identitySubjectId,
        topic: input.topic,
        on: input.on,
      });
      return outcome === "saved" ? null : outcome;
    },
  };
}

export type AccountEmailAlertHandlers = ReturnType<typeof createAccountEmailAlertHandlers>;
