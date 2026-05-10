import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { legalEntity } from "./legal-entities.js";

export const legalEntityOnboardingProgress = pgTable(
  "legal_entity_onboarding_progress",
  {
    legalEntityId: uuid("legal_entity_id")
      .notNull()
      .references(() => legalEntity.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    completedAt: timestamp("completed_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.legalEntityId, table.stepKey] }),
    index("legal_entity_onboarding_progress_entity_idx").on(table.legalEntityId),
  ],
);

export const legalEntityOnboardingProgressRelations = relations(
  legalEntityOnboardingProgress,
  ({ one }) => ({
    legalEntity: one(legalEntity, {
      fields: [legalEntityOnboardingProgress.legalEntityId],
      references: [legalEntity.id],
    }),
  }),
);
