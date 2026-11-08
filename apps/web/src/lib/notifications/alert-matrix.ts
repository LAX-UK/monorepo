import {
  type BooleanNotificationFieldName,
  type NotificationPreferencesFormValues,
  buildNotificationPreset,
} from "@/lib/notifications/notification-preferences-registry";
import {
  LOCKED_NOTIFICATION_PREFERENCE_REASON,
  notificationPreferenceLocked,
} from "@auction/domain";

/**
 * Bid settings' "Where alerts reach you": one row per alert, with an Email and an App column.
 * App covers the alert inside LAX Bid and on the devices where app notifications are turned on,
 * so one switch sets both. WhatsApp is hidden until it launches. Extend the table, not the page.
 */
export type AlertRow = {
  id: string;
  label: string;
  description: string;
  email: BooleanNotificationFieldName | null;
  app: readonly BooleanNotificationFieldName[];
  /**
   * An alert the alert engine sends (the daily digest): its Email switch is the engine's topic
   * switch, not a notification preference, and its App switch only counts once subscribed.
   */
  engineTopic?: string;
  /**
   * The app notice is built from the daily email, so it only arrives while the email is on. Its
   * App switch reads off, and is held, until the Email switch is on.
   */
  appComesWithEmail?: boolean;
};

/** What the alert engine holds for the signed-in client, per topic. */
export type EngineAlertState = {
  /** The topic has a subscription (email on or off), so its app notice reaches the person. */
  subscribed: Readonly<Record<string, boolean>>;
  /** The topic's email is on. */
  email: Readonly<Record<string, boolean>>;
  /** The client stopped all alerts, so turning one on starts them again. */
  stopped?: boolean;
};

export const ALERT_ROWS: readonly AlertRow[] = [
  {
    id: "outbid",
    label: "Outbid",
    description: "When someone bids over you",
    email: "outbidEmail",
    app: ["outbidInApp", "outbidPush"],
  },
  {
    id: "closing",
    label: "Lot closing soon",
    description: "Before a lot you bid on or watch closes",
    email: "endingSoonEmail",
    app: ["endingSoonInApp", "endingSoonPush"],
  },
  {
    id: "won",
    label: "You won a lot",
    description: "With the invoice and how to pay",
    email: "wonEmail",
    app: ["wonInApp", "wonPush"],
  },
  {
    id: "lost",
    label: "A lot sold to someone else",
    description: "When a lot you bid on closes without you",
    email: "lostEmail",
    app: ["lostInApp"],
  },
  {
    id: "payments",
    label: "Payments",
    description: "Invoices, receipts and reminders to pay",
    email: "paymentEmail",
    app: ["paymentInApp"],
  },
  {
    id: "consignments",
    label: "Consignment updates",
    description: "Review, agreement and sale steps",
    email: "submissionUpdatesEmail",
    app: ["submissionUpdatesPush"],
  },
  {
    id: "sale-ended",
    label: "Your work's sale ended",
    description: "When a lot you sell closes, sold or not",
    email: "lotEndedSellerEmail",
    app: [],
  },
  {
    id: "watching",
    label: "Lots you watch",
    description: "When a watched lot opens or has news",
    email: "watchlistEmail",
    app: ["watchlistInApp"],
  },
  {
    id: "new-sales",
    label: "New sales",
    description: "When LAX Bid announces a sale",
    email: null,
    app: ["newSalesInApp"],
    engineTopic: "bid.new_sales",
  },
  {
    id: "artists",
    label: "Artists you follow",
    description: "New lots that match each artist's alert",
    email: null,
    app: ["artistAlertsInApp"],
    engineTopic: "bid.artists",
    appComesWithEmail: true,
  },
  {
    id: "searches",
    label: "Saved searches",
    description: "New lots that match a search with email on",
    email: null,
    app: ["searchAlertsInApp"],
    engineTopic: "bid.searches",
    appComesWithEmail: true,
  },
];

export type AlertChannel = "email" | "app";

/** A cell of the matrix: whether it exists, is on, and is held on (with the reason). */
export type AlertCell =
  | { kind: "none" }
  | {
      kind: "switch";
      checked: boolean;
      lockedReason: string | null;
      /** Off and not changeable for now, and why. */
      disabledReason?: string;
    };

/** Why an app notice cannot be switched on while its email is off. */
export const APP_COMES_WITH_EMAIL_REASON = "Comes with the email";

export function alertCell(
  row: AlertRow,
  channel: AlertChannel,
  values: NotificationPreferencesFormValues,
  engine: EngineAlertState | null = null,
): AlertCell {
  if (row.engineTopic) {
    if (!engine) return { kind: "none" };
    if (channel === "email") {
      return {
        kind: "switch",
        checked: engine.email[row.engineTopic] === true,
        lockedReason: null,
      };
    }
    const [field] = row.app;
    if (row.appComesWithEmail && engine.email[row.engineTopic] !== true) {
      return {
        kind: "switch",
        checked: false,
        lockedReason: null,
        disabledReason: APP_COMES_WITH_EMAIL_REASON,
      };
    }
    return {
      kind: "switch",
      checked:
        engine.subscribed[row.engineTopic] === true && (field ? values[field] === true : true),
      lockedReason: null,
    };
  }
  const fields = channel === "email" ? (row.email ? [row.email] : []) : row.app;
  const [first] = fields;
  if (!first) return { kind: "none" };
  const locked = fields.some((field) => notificationPreferenceLocked(field));
  return {
    kind: "switch",
    checked: locked || values[first] === true,
    lockedReason: locked ? LOCKED_NOTIFICATION_PREFERENCE_REASON : null,
  };
}

/** The values after turning one cell on or off; locked fields never change. */
export function withAlertCell(
  values: NotificationPreferencesFormValues,
  row: AlertRow,
  channel: AlertChannel,
  on: boolean,
): NotificationPreferencesFormValues {
  const fields = channel === "email" ? (row.email ? [row.email] : []) : row.app;
  const next = { ...values };
  for (const field of fields) {
    if (!notificationPreferenceLocked(field)) next[field] = on;
  }
  return next;
}

export const ALERT_PRESETS = ["essential", "activeBidder", "quiet"] as const;
export type AlertPreset = (typeof ALERT_PRESETS)[number];

export const ALERT_PRESET_COPY: Record<AlertPreset, { label: string; description: string }> = {
  essential: { label: "Essential only", description: "Outbid, wins and payments." },
  activeBidder: {
    label: "Active bidder",
    description: "Adds closing reminders, results and lots you watch.",
  },
  quiet: { label: "Quiet for now", description: "Pauses optional alerts until you choose again." },
};

/** The values with a preset applied; locked alerts stay on. */
export function withAlertPreset(
  values: NotificationPreferencesFormValues,
  preset: AlertPreset,
): NotificationPreferencesFormValues {
  const next = { ...values, ...buildNotificationPreset(preset) };
  for (const key of Object.keys(next) as (keyof NotificationPreferencesFormValues)[]) {
    if (notificationPreferenceLocked(key)) (next as Record<string, unknown>)[key] = true;
  }
  return next;
}

/** The preset the values match, or `null` for a mix of the person's own. */
export function alertPresetOf(values: NotificationPreferencesFormValues): AlertPreset | null {
  return (
    ALERT_PRESETS.find((preset) => {
      const wanted = buildNotificationPreset(preset);
      return (Object.keys(wanted) as BooleanNotificationFieldName[]).every(
        (key) => notificationPreferenceLocked(key) || values[key] === wanted[key],
      );
    }) ?? null
  );
}
