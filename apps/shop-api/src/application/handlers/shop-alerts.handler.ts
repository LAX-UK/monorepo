import {
  type AlertLinkCodec,
  type AlertProduct,
  type ConfirmService,
  type PreferencesService,
  type StopService,
  type SubscribeService,
  type SubscriberRecord,
  maskEmail,
} from "@auction/alerts";
import { normalizeAlertEmail } from "../edition-alert-email.js";

const DEFAULT_SOURCE = "shop_home";

export type SubscribeReleaseAlertsResult = "check_email" | "subscribed" | "already_subscribed";

export type AlertConfirmResult = "confirmed" | "expired" | "invalid";

export type AlertStopPreview = { maskedEmail: string; active: boolean };

/** Finds the row an email sent before the alert engine pointed at, by the hash of its stop token. */
export interface LegacyStopLookup {
  findByLegacyLinkHash(hash: string): Promise<SubscriberRecord | null>;
}

export type ShopAlertHandlerDeps = {
  subscribe: Pick<SubscribeService, "requestAsVisitor" | "enableForAccount">;
  confirm: Pick<ConfirmService, "confirm">;
  stop: Pick<StopService, "preview" | "stop" | "stopOneClick">;
  preferences: Pick<PreferencesService, "view" | "setTopic">;
  codec: Pick<AlertLinkCodec, "verify">;
  /** Stops a row by id; used for links from emails sent before the engine. */
  stopLegacy: (id: string, now: Date) => Promise<void>;
  legacy: LegacyStopLookup;
  hashLegacyToken: (token: string) => string;
  now?: () => Date;
};

/**
 * LAX Shop and lax.art email alerts: ask, confirm, see, stop, and stop from an email link. The
 * link says which product it belongs to, so one set of addresses serves both.
 */
export function createShopAlertHandlers(deps: ShopAlertHandlerDeps) {
  const now = deps.now ?? (() => new Date());

  const productOf = (token: string): AlertProduct | null =>
    deps.codec.verify(token, now())?.payload.product ?? null;

  async function legacyRow(token: string): Promise<SubscriberRecord | null> {
    return deps.legacy.findByLegacyLinkHash(deps.hashLegacyToken(token));
  }

  async function isOn(identitySubjectId: string): Promise<boolean> {
    const view = await deps.preferences.view("shop", identitySubjectId);
    return (
      view.state === "confirmed" &&
      view.topics.some((t) => t.topic === "shop.releases" && t.emailOn)
    );
  }

  return {
    /**
     * A visitor always gets `check_email`: whether the address was new, waiting or confirmed is
     * for its owner to learn from the inbox.
     */
    async subscribeGuest(input: { email: string; source?: string | undefined }) {
      await deps.subscribe.requestAsVisitor({
        product: "shop",
        topic: "shop.releases",
        email: normalizeAlertEmail(input.email),
        source: input.source ?? DEFAULT_SOURCE,
      });
      return "check_email" as const;
    },

    /** Null when the account has no address that can be written to. */
    async subscribeAccount(input: {
      identitySubjectId: string;
      source?: string | undefined;
    }): Promise<SubscribeReleaseAlertsResult | null> {
      if (await isOn(input.identitySubjectId)) return "already_subscribed";
      const outcome = await deps.subscribe.enableForAccount({
        product: "shop",
        subjectId: input.identitySubjectId,
        topic: "shop.releases",
        source: input.source ?? DEFAULT_SOURCE,
      });
      return outcome === "enabled" ? "subscribed" : null;
    },

    isSubscribed: isOn,

    async stopAccount(identitySubjectId: string): Promise<void> {
      await deps.preferences.setTopic({
        product: "shop",
        subjectId: identitySubjectId,
        topic: "shop.releases",
        on: false,
      });
    },

    /** `already_confirmed` is reported as `confirmed`: a second press changes nothing. */
    async confirm(token: string): Promise<AlertConfirmResult> {
      const product = productOf(token);
      if (!product) return "invalid";
      const outcome = await deps.confirm.confirm(token, product);
      return outcome === "already_confirmed" ? "confirmed" : outcome;
    },

    /** Null when the token matches nothing. */
    async previewUnsubscribe(token: string): Promise<AlertStopPreview | null> {
      const product = productOf(token);
      if (product) {
        const preview = await deps.stop.preview(token, product);
        if (preview.state === "invalid") return null;
        return { maskedEmail: preview.maskedEmail, active: preview.state === "ready" };
      }
      const row = await legacyRow(token);
      return row ? { maskedEmail: maskEmail(row.email), active: row.status !== "stopped" } : null;
    },

    /** False when the token matches nothing. Safe to repeat. */
    async unsubscribe(token: string): Promise<boolean> {
      const product = productOf(token);
      if (product) {
        return (await deps.stop.stop(token, product, { scope: "all" })) !== "invalid";
      }
      const row = await legacyRow(token);
      if (!row) return false;
      if (row.status !== "stopped") await deps.stopLegacy(row.id, now());
      return true;
    },
  };
}

export type ShopAlertHandlers = ReturnType<typeof createShopAlertHandlers>;
