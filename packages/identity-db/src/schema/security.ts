import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

/**
 * Browsers and devices a person has signed in from, kept to decide whether a sign-in deserves a
 * "new sign-in" email. `fingerprint` is a hash of the person's id, a version-free browser and
 * system label and a coarse region, so the table holds no user agent string and no IP address.
 * `notified_at` is the last time that device triggered an email and backs the per-person rate limit.
 */
export const authKnownDevice = pgTable(
  "auth_known_device",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    firstSeenAt: timestamp("first_seen_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    notifiedAt: timestamp("notified_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.fingerprint] }),
    index("auth_known_device_user_notified_idx").on(table.userId, table.notifiedAt),
  ],
);

/**
 * Security side effects (ending sessions and tokens, announcing a credential change) that failed
 * once after the change that caused them had already committed. The issuer's worker retries them
 * from here so a restart cannot lose a revocation. A succeeded job is deleted; one that ran out of
 * attempts stays as `abandoned` for an operator to inspect.
 */
export const authSecurityEffectOutbox = pgTable(
  "auth_security_effect_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    /** Who the effect is about; deliberately not a foreign key so a deleted user does not block purging. */
    userId: text("user_id"),
    status: text("status").notNull().default("pending"),
    /** Attempts made so far, including the immediate one that failed before this row was written. */
    attemptCount: integer("attempt_count").notNull().default(1),
    nextAttemptAt: timestamp("next_attempt_at", { mode: "date", withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { mode: "date", withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("auth_security_effect_outbox_due_idx").on(table.status, table.nextAttemptAt)],
);
