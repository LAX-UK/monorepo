import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const qrCodeEntityTypeEnum = pgEnum("qr_code_entity_type", ["sale", "lot"]);
export const qrCodeStatusEnum = pgEnum("qr_code_status", ["active", "disabled"]);

export const qrCode = pgTable(
  "qr_code",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shortCode: text("short_code").notNull(),
    entityType: qrCodeEntityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    isDefault: boolean("is_default").notNull().default(true),
    campaign: text("campaign"),
    placement: text("placement"),
    status: qrCodeStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("qr_code_short_code_uid").on(table.shortCode),
    uniqueIndex("qr_code_default_entity_uid")
      .on(table.entityType, table.entityId)
      .where(sql`${table.isDefault} = true`),
    index("qr_code_entity_idx").on(table.entityType, table.entityId),
    index("qr_code_status_idx").on(table.status),
  ],
);

export const qrCodeScan = pgTable(
  "qr_code_scan",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    qrCodeId: uuid("qr_code_id")
      .notNull()
      .references(() => qrCode.id, { onDelete: "cascade" }),
    scannedAt: timestamp("scanned_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    ipPrefix: text("ip_prefix"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    deviceType: text("device_type"),
    browser: text("browser"),
    os: text("os"),
    referrerHost: text("referrer_host"),
    requestId: text("request_id"),
  },
  (table) => [
    index("qr_code_scan_code_time_idx").on(table.qrCodeId, table.scannedAt),
    index("qr_code_scan_time_idx").on(table.scannedAt),
  ],
);

export const qrCodeScanDaily = pgTable(
  "qr_code_scan_daily",
  {
    qrCodeId: uuid("qr_code_id")
      .notNull()
      .references(() => qrCode.id, { onDelete: "cascade" }),
    day: timestamp("day", { mode: "date", withTimezone: true }).notNull(),
    country: text("country").notNull().default("unknown"),
    deviceType: text("device_type").notNull().default("unknown"),
    scans: integer("scans").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("qr_code_scan_daily_uid").on(
      table.qrCodeId,
      table.day,
      table.country,
      table.deviceType,
    ),
    index("qr_code_scan_daily_code_day_idx").on(table.qrCodeId, table.day),
  ],
);

export const qrCodeRelations = relations(qrCode, ({ one, many }) => ({
  createdByUser: one(user, {
    fields: [qrCode.createdByUserId],
    references: [user.id],
  }),
  scans: many(qrCodeScan),
}));

export const qrCodeScanRelations = relations(qrCodeScan, ({ one }) => ({
  qrCode: one(qrCode, {
    fields: [qrCodeScan.qrCodeId],
    references: [qrCode.id],
  }),
}));

export const qrCodeScanDailyRelations = relations(qrCodeScanDaily, ({ one }) => ({
  qrCode: one(qrCode, {
    fields: [qrCodeScanDaily.qrCodeId],
    references: [qrCode.id],
  }),
}));
