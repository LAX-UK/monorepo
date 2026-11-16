import {
  type BooleanNotificationFieldName,
  type NotificationPreferencesFormValues,
  buildNotificationPreset,
} from "@/lib/notifications/notification-preferences-registry";
import {
  LOCKED_NOTIFICATION_PREFERENCE_REASON,
  notificationPreferenceLocked,
} from "@auction/domain";
import { ALERT_ROW_COPY, ALWAYS_EMAILED_REASON } from "./alert-matrix-copy";

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
   * The email records a decision about the person, so it is always sent: the Email column shows
   * it on and held, with this reason, and there is nothing to switch.
   */
  emailAlways?: string;
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
    ...ALERT_ROW_COPY.outbid,
    email: "outbidEmail",
    app: ["outbidInApp", "outbidPush"],
  },
  {
    id: "closing",
    ...ALERT_ROW_COPY.closing,
    email: "endingSoonEmail",
    app: ["endingSoonInApp", "endingSoonPush"],
  },
  {
    id: "won",
    ...ALERT_ROW_COPY.won,
    email: "wonEmail",
    app: ["wonInApp", "wonPush"],
  },
  {
    id: "lost",
    ...ALERT_ROW_COPY.lost,
    email: "lostEmail",
    app: ["lostInApp"],
  },
  {
    id: "payments",
    ...ALERT_ROW_COPY.payments,
    email: "paymentEmail",
    app: ["paymentInApp"],
  },
  {
    id: "consignments",
    ...ALERT_ROW_COPY.consignments,
    email: "submissionUpdatesEmail",
    app: ["submissionUpdatesPush"],
  },
  {
    id: "sale-ended",
    ...ALERT_ROW_COPY["sale-ended"],
    email: "lotEndedSellerEmail",
    app: [],
  },
  {
    id: "watching",
    ...ALERT_ROW_COPY.watching,
    email: "watchlistEmail",
    app: ["watchlistInApp"],
  },
  {
    id: "identity",
    ...ALERT_ROW_COPY.identity,
    email: null,
    emailAlways: ALWAYS_EMAILED_REASON.identity,
    app: ["identityInApp"],
  },
  {
    id: "registrations",
    ...ALERT_ROW_COPY.registrations,
    email: null,
    emailAlways: ALWAYS_EMAILED_REASON.registrations,
    app: ["registrationInApp"],
  },
  {
    id: "new-sales",
    ...ALERT_ROW_COPY["new-sales"],
    email: null,
    app: ["newSalesInApp"],
    engineTopic: "bid.new_sales",
  },
  {
    id: "artists",
    ...ALERT_ROW_COPY.artists,
    email: null,
    app: ["artistAlertsInApp"],
    engineTopic: "bid.artists",
  },
  {
    id: "searches",
    ...ALERT_ROW_COPY.searches,
    email: null,
    app: ["searchAlertsInApp"],
    engineTopic: "bid.searches",
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
    return {
      kind: "switch",
      checked:
        engine.subscribed[row.engineTopic] === true && (field ? values[field] === true : true),
      lockedReason: null,
    };
  }
  if (channel === "email" && row.emailAlways) {
    return { kind: "switch", checked: true, lockedReason: row.emailAlways };
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
