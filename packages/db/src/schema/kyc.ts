import { relations } from "drizzle-orm";
import { date, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const kycVerificationStatusEnum = pgEnum("kyc_verification_status", [
  "created",
  "requires_input",
  "processing",
  "verified",
  "canceled",
]);

export const kycVerification = pgTable(
  "kyc_verification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("veriff"),
    providerSessionId: text("provider_session_id").notNull().unique(),
    providerAttemptId: text("provider_attempt_id"),
    status: kycVerificationStatusEnum("status").notNull(),
    verifiedFirstName: text("verified_first_name"),
    verifiedLastName: text("verified_last_name"),
    verifiedDateOfBirth: date("verified_date_of_birth"),
    verifiedIdNumberLast4: text("verified_id_number_last4"),
    verifiedIdCountry: text("verified_id_country"),
    verifiedIdType: text("verified_id_type"),
    verifiedIdExpiry: date("verified_id_expiry"),
    decisionPayload: jsonb("decision_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    decisionAt: timestamp("decision_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("kyc_verification_user_id_idx").on(table.userId),
    index("kyc_verification_status_idx").on(table.status),
  ],
);

export const kycVerificationRelations = relations(kycVerification, ({ one }) => ({
  user: one(user, {
    fields: [kycVerification.userId],
    references: [user.id],
  }),
}));
