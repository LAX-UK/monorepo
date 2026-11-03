import { RELEASE_ALERT_CONSENT_TEXT } from "@auction/shop-domain";
import { maskAlertEmail, normalizeAlertEmail } from "../edition-alert-email.js";
import type { ReleaseAlertStore } from "../ports/release-alert.store.js";

const DEFAULT_SOURCE = "shop_home";

export type SubscribeReleaseAlertsResult = "check_email" | "subscribed" | "already_subscribed";

/** Release alerts: ask, confirm, see, stop, and stop from an email link. */
export function createReleaseAlertHandlers(deps: {
  store: ReleaseAlertStore;
  /** The verified address of a LAX Account, or null when it has none. */
  accountEmail: (identitySubjectId: string) => Promise<string | null>;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  const consentFor = (source: string | undefined) => ({
    text: RELEASE_ALERT_CONSENT_TEXT,
    source: source ?? DEFAULT_SOURCE,
  });

  async function addressOf(identitySubjectId: string): Promise<string | null> {
    const email = await deps.accountEmail(identitySubjectId);
    return email ? normalizeAlertEmail(email) : null;
  }

  return {
    /**
     * A visitor always gets `check_email`: whether the address was new, waiting or confirmed is
     * for its owner to learn from the inbox.
     */
    async subscribeGuest(input: { email: string; source?: string | undefined }) {
      await deps.store.requestConfirmation({
        email: normalizeAlertEmail(input.email),
        consent: consentFor(input.source),
        now: now(),
      });
      return "check_email" as const;
    },

    /** Null when the account has no address to write to. */
    async subscribeAccount(input: {
      identitySubjectId: string;
      source?: string | undefined;
    }): Promise<SubscribeReleaseAlertsResult | null> {
      const email = await addressOf(input.identitySubjectId);
      if (!email) return null;
      return deps.store.subscribeAccount({
        email,
        identitySubjectId: input.identitySubjectId,
        consent: consentFor(input.source),
        now: now(),
      });
    },

    async isSubscribed(identitySubjectId: string): Promise<boolean> {
      const email = await addressOf(identitySubjectId);
      return email ? deps.store.isConfirmed(email) : false;
    },

    async stopAccount(identitySubjectId: string): Promise<void> {
      const email = await addressOf(identitySubjectId);
      if (email) await deps.store.stopByEmail(email, now());
    },

    confirm: (token: string) => deps.store.confirm(token, now()),

    async previewUnsubscribe(token: string) {
      const preview = await deps.store.previewUnsubscribe(token);
      return preview
        ? { maskedEmail: maskAlertEmail(preview.email), active: preview.active }
        : null;
    },

    unsubscribe: (token: string) => deps.store.unsubscribe(token, now()),
  };
}

export type ReleaseAlertHandlers = ReturnType<typeof createReleaseAlertHandlers>;
