import type { Database } from "@auction/db";
import { notificationPreference } from "@auction/db/schema";
import type { NotificationPreference } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type {
  INotificationPreferenceReader,
  INotificationPreferenceWriter,
  NotificationPreferenceInput,
} from "../interfaces/notification-preference.repository.js";
import {
  defaultNotificationPreference,
  emailPreferenceKey,
  inAppPreferenceKey,
  pushPreferenceKey,
  whatsappPreferenceKey,
} from "../lib/notification-preference-keys.js";

type Row = InferSelectModel<typeof notificationPreference>;

function mapRow(row: Row): NotificationPreference {
  return {
    userId: row.userId,
    outbidInApp: row.outbidInApp,
    wonInApp: row.wonInApp,
    lostInApp: row.lostInApp,
    endingSoonInApp: row.endingSoonInApp,
    watchlistInApp: row.watchlistInApp,
    paymentInApp: row.paymentInApp,
    outbidPush: row.outbidPush,
    wonPush: row.wonPush,
    endingSoonPush: row.endingSoonPush,
    outbidEmail: row.outbidEmail,
    wonEmail: row.wonEmail,
    lostEmail: row.lostEmail,
    endingSoonEmail: row.endingSoonEmail,
    watchlistEmail: row.watchlistEmail,
    paymentEmail: row.paymentEmail,
    lotEndedSellerEmail: row.lotEndedSellerEmail,
    submissionUpdatesEmail: row.submissionUpdatesEmail,
    submissionUpdatesPush: row.submissionUpdatesPush,
    outbidWhatsapp: row.outbidWhatsapp,
    wonWhatsapp: row.wonWhatsapp,
    lostWhatsapp: row.lostWhatsapp,
    endingSoonWhatsapp: row.endingSoonWhatsapp,
    watchlistWhatsapp: row.watchlistWhatsapp,
    paymentWhatsapp: row.paymentWhatsapp,
    lotEndedSellerWhatsapp: row.lotEndedSellerWhatsapp,
    quietStart: row.quietStart ?? null,
    quietEnd: row.quietEnd ?? null,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleNotificationPreferenceRepository
  implements INotificationPreferenceReader, INotificationPreferenceWriter
{
  constructor(private readonly db: Database) {}

  async getForUser(userId: string): Promise<NotificationPreference | null> {
    const [row] = await this.db
      .select()
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, userId))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async isChannelEnabled(
    userId: string,
    type: string,
    channel: "in_app" | "push" | "email" | "whatsapp",
  ): Promise<boolean> {
    const row = await this.getForUser(userId);
    const merged = row ?? defaultNotificationPreference(userId);
    const key =
      channel === "in_app"
        ? inAppPreferenceKey(type)
        : channel === "push"
          ? pushPreferenceKey(type)
          : channel === "email"
            ? emailPreferenceKey(type)
            : whatsappPreferenceKey(type);
    if (!key) return true;
    const v = merged[key];
    return typeof v === "boolean" ? v : true;
  }

  async upsert(
    userId: string,
    prefs: Partial<NotificationPreferenceInput>,
  ): Promise<NotificationPreference> {
    const existing = await this.getForUser(userId);
    const base = existing ?? defaultNotificationPreference(userId);
    const patch: NotificationPreference = {
      ...base,
      ...prefs,
      userId,
      updatedAt: new Date(),
    };
    const [row] = await this.db
      .insert(notificationPreference)
      .values({
        userId,
        outbidInApp: patch.outbidInApp,
        wonInApp: patch.wonInApp,
        lostInApp: patch.lostInApp,
        endingSoonInApp: patch.endingSoonInApp,
        watchlistInApp: patch.watchlistInApp,
        paymentInApp: patch.paymentInApp,
        outbidPush: patch.outbidPush,
        wonPush: patch.wonPush,
        endingSoonPush: patch.endingSoonPush,
        outbidEmail: patch.outbidEmail,
        wonEmail: patch.wonEmail,
        lostEmail: patch.lostEmail,
        endingSoonEmail: patch.endingSoonEmail,
        watchlistEmail: patch.watchlistEmail,
        paymentEmail: patch.paymentEmail,
        lotEndedSellerEmail: patch.lotEndedSellerEmail,
        submissionUpdatesEmail: patch.submissionUpdatesEmail,
        submissionUpdatesPush: patch.submissionUpdatesPush,
        outbidWhatsapp: patch.outbidWhatsapp,
        wonWhatsapp: patch.wonWhatsapp,
        lostWhatsapp: patch.lostWhatsapp,
        endingSoonWhatsapp: patch.endingSoonWhatsapp,
        watchlistWhatsapp: patch.watchlistWhatsapp,
        paymentWhatsapp: patch.paymentWhatsapp,
        lotEndedSellerWhatsapp: patch.lotEndedSellerWhatsapp,
        quietStart: patch.quietStart,
        quietEnd: patch.quietEnd,
        updatedAt: patch.updatedAt,
      })
      .onConflictDoUpdate({
        target: notificationPreference.userId,
        set: {
          outbidInApp: patch.outbidInApp,
          wonInApp: patch.wonInApp,
          lostInApp: patch.lostInApp,
          endingSoonInApp: patch.endingSoonInApp,
          watchlistInApp: patch.watchlistInApp,
          paymentInApp: patch.paymentInApp,
          outbidPush: patch.outbidPush,
          wonPush: patch.wonPush,
          endingSoonPush: patch.endingSoonPush,
          outbidEmail: patch.outbidEmail,
          wonEmail: patch.wonEmail,
          lostEmail: patch.lostEmail,
          endingSoonEmail: patch.endingSoonEmail,
          watchlistEmail: patch.watchlistEmail,
          paymentEmail: patch.paymentEmail,
          lotEndedSellerEmail: patch.lotEndedSellerEmail,
          submissionUpdatesEmail: patch.submissionUpdatesEmail,
          submissionUpdatesPush: patch.submissionUpdatesPush,
          outbidWhatsapp: patch.outbidWhatsapp,
          wonWhatsapp: patch.wonWhatsapp,
          lostWhatsapp: patch.lostWhatsapp,
          endingSoonWhatsapp: patch.endingSoonWhatsapp,
          watchlistWhatsapp: patch.watchlistWhatsapp,
          paymentWhatsapp: patch.paymentWhatsapp,
          lotEndedSellerWhatsapp: patch.lotEndedSellerWhatsapp,
          quietStart: patch.quietStart,
          quietEnd: patch.quietEnd,
          updatedAt: patch.updatedAt,
        },
      })
      .returning();
    if (!row) {
      const again = await this.getForUser(userId);
      return again ?? patch;
    }
    return mapRow(row);
  }
}
