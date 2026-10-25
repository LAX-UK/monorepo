import { isArtworkEligibleForNotifyMeSubscription } from "../artwork-notify-me-policy.js";
import type { ArtworkInterestWriter } from "../ports/artwork-interest.writer.js";
import type { EditionAlertRecipient, EditionAlertStore } from "../ports/edition-alert.store.js";

export type RegisterEditionAlertResult =
  | "registered"
  | "already_subscribed"
  | "artwork_not_found"
  | "not_subscribable";

/** Edition alerts: ask, list, stop from the account, and stop from an email link. */
export function createEditionAlertHandlers(deps: {
  artworks: Pick<ArtworkInterestWriter, "loadInterestContext">;
  alerts: EditionAlertStore;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return {
    async register(input: {
      artworkSlug: string;
      recipient: EditionAlertRecipient;
    }): Promise<RegisterEditionAlertResult> {
      const context = await deps.artworks.loadInterestContext(input.artworkSlug);
      if (!context) return "artwork_not_found";
      // Only a sold-out edition takes alerts; an available one can simply be bought.
      if (!isArtworkEligibleForNotifyMeSubscription(context)) return "not_subscribable";
      return deps.alerts.registerAlert({
        artworkId: context.artworkId,
        recipient: input.recipient,
      });
    },

    listForSubject: (identitySubjectId: string) =>
      deps.alerts.listWaitingForSubject(identitySubjectId),

    cancelForSubject: (input: {
      identitySubjectId: string;
      target: { alertId: string } | { artworkSlug: string };
    }) => deps.alerts.cancelForSubject({ ...input, now: now() }),

    previewUnsubscribe: (token: string) => deps.alerts.previewUnsubscribe(token),

    unsubscribe: (token: string) => deps.alerts.unsubscribe(token, now()),
  };
}

export type EditionAlertHandlers = ReturnType<typeof createEditionAlertHandlers>;
