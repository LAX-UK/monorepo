import type { BackInStockLinks } from "../../infrastructure/alerts/back-in-stock-links.js";
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
  /** The alert engine's links, to move an old edition alert link onto the engine. */
  links?: Pick<BackInStockLinks, "linkFor">;
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

    /**
     * The engine stop token that replaces an old edition alert link, so a link from an email sent
     * before back in stock moved onto the engine opens the shared stop page. Null when the old
     * link matches nothing, or the alert has no address to write to.
     */
    async engineStopToken(token: string): Promise<string | null> {
      if (!deps.links) return null;
      const owner = await deps.alerts.ownerOfToken(token);
      if (!owner?.email) return null;
      const link = await deps.links.linkFor({
        email: owner.email,
        subjectId: owner.identitySubjectId,
      });
      return link.token;
    },
  };
}

export type EditionAlertHandlers = ReturnType<typeof createEditionAlertHandlers>;
