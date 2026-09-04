import { bigint, boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Bid-local projection of the Identity fields needed by API and worker paths.
 * The subject is intentionally not foreign-keyed to the Identity-owned user table.
 */
export const bidIdentityDirectory = pgTable(
  "bid_identity_directory",
  {
    subjectId: text("subject_id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    image: text("image"),
    phone: text("phone"),
    emailVerified: boolean("email_verified").notNull().default(false),
    deletionRequestedAt: timestamp("deletion_requested_at", {
      mode: "date",
      withTimezone: true,
    }),
    /** Canonical subject for a retired alias retained for product-record joins. */
    mergedIntoSubjectId: text("merged_into_subject_id"),
    identityCreatedAt: timestamp("identity_created_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    replicatedAt: timestamp("replicated_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    lastEventId: bigint("last_event_id", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    index("bid_identity_directory_email_idx").on(table.email),
    index("bid_identity_directory_phone_idx").on(table.phone),
    index("bid_identity_directory_merged_into_idx").on(table.mergedIntoSubjectId),
  ],
);
