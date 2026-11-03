import {
  legalEntity,
  notification,
  notificationAccountMute,
  notificationPreference,
  pushSubscription,
} from "@auction/db/schema";
import { and, asc, eq, notLike } from "drizzle-orm";
import {
  type ExportSource,
  type SourceRow,
  SourcedExportCategory,
  inMemorySource,
} from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

/**
 * Notices about compliance reviews (source of funds, AML) are left out of the history, so the copy
 * cannot show that a review took place. Only the title is exported, never the message text.
 */
export const EXCLUDED_NOTIFICATION_TYPE_PREFIXES = ["source_of_funds", "aml"] as const;

const notExcluded = EXCLUDED_NOTIFICATION_TYPE_PREFIXES.map((prefix) =>
  notLike(notification.type, `${prefix}%`),
);

export function mapNotification(row: {
  id: string;
  title: string;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: row.id,
    origin: "observed" as const,
    kind: "notification",
    title: row.title,
    sentAt: isoRequired(row.createdAt),
    // Bid records whether a notice was read, not when.
    read: row.read,
  };
}

const PREFERENCE_COLUMNS = [
  ["outbidInApp", "outbid", "in-app"],
  ["wonInApp", "won", "in-app"],
  ["lostInApp", "lost", "in-app"],
  ["endingSoonInApp", "ending soon", "in-app"],
  ["watchlistInApp", "watchlist", "in-app"],
  ["paymentInApp", "payment", "in-app"],
  ["newSalesInApp", "new sales", "in-app"],
  ["outbidPush", "outbid", "push"],
  ["wonPush", "won", "push"],
  ["endingSoonPush", "ending soon", "push"],
  ["submissionUpdatesPush", "consignment updates", "push"],
  ["outbidEmail", "outbid", "email"],
  ["wonEmail", "won", "email"],
  ["lostEmail", "lost", "email"],
  ["endingSoonEmail", "ending soon", "email"],
  ["watchlistEmail", "watchlist", "email"],
  ["paymentEmail", "payment", "email"],
  ["lotEndedSellerEmail", "your lot ended", "email"],
  ["submissionUpdatesEmail", "consignment updates", "email"],
  ["outbidWhatsapp", "outbid", "whatsapp"],
  ["wonWhatsapp", "won", "whatsapp"],
  ["lostWhatsapp", "lost", "whatsapp"],
  ["endingSoonWhatsapp", "ending soon", "whatsapp"],
  ["watchlistWhatsapp", "watchlist", "whatsapp"],
  ["paymentWhatsapp", "payment", "whatsapp"],
  ["lotEndedSellerWhatsapp", "your lot ended", "whatsapp"],
] as const;

type PreferenceRow = Record<(typeof PREFERENCE_COLUMNS)[number][0], boolean>;

export function mapPreferences(subjectId: string, row: PreferenceRow): SourceRow[] {
  return PREFERENCE_COLUMNS.map(([column, title, channel]) => ({
    key: `${subjectId}:${column}`,
    record: {
      id: `${subjectId}:${column}`,
      origin: "provided" as const,
      kind: "preference",
      title,
      channel,
      enabled: row[column],
    },
  }));
}

export class NotificationsCategory extends SourcedExportCategory {
  readonly id = "notifications";
  protected readonly sources: readonly ExportSource[];

  constructor({ db }: SubjectExportDeps) {
    super();
    this.sources = [
      {
        count: (s) => countWhere(db, notification, and(eq(notification.userId, s), ...notExcluded)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: notification.id,
              title: notification.title,
              read: notification.read,
              createdAt: notification.createdAt,
            })
            .from(notification)
            .where(
              and(eq(notification.userId, s), ...notExcluded, afterKey(notification.id, after)),
            )
            .orderBy(asc(notification.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapNotification(row) }));
        },
      },
      inMemorySource(async (s) => {
        const [row] = await db
          .select()
          .from(notificationPreference)
          .where(eq(notificationPreference.userId, s))
          .limit(1);
        return row ? mapPreferences(s, row) : [];
      }),
      inMemorySource(async (s) => {
        const rows = await db
          .select({ id: pushSubscription.id })
          .from(pushSubscription)
          .where(eq(pushSubscription.userId, s));
        // The endpoint and keys that identify a browser are secrets of the subscription; Bid keeps
        // no device label, so only the fact of the subscription is listed.
        return rows.map((row) => ({
          key: row.id,
          record: {
            id: row.id,
            origin: "provided" as const,
            kind: "push_subscription",
            channel: "push",
            deviceLabel: null,
          },
        }));
      }),
      inMemorySource(async (s) => {
        const rows = await db
          .select({ id: notificationAccountMute.legalEntityId, name: legalEntity.displayName })
          .from(notificationAccountMute)
          .innerJoin(legalEntity, eq(legalEntity.id, notificationAccountMute.legalEntityId))
          .where(eq(notificationAccountMute.userId, s));
        return rows.map((row) => ({
          key: row.id,
          record: {
            id: `mute:${row.id}`,
            origin: "provided" as const,
            kind: "mute",
            title: row.name,
          },
        }));
      }),
    ];
  }
}
