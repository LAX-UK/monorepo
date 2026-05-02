import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const jwksKey = pgTable(
  "jwks_key",
  {
    kid: text("kid").primaryKey(),
    algorithm: text("algorithm").notNull().default("RS256"),
    publicJwk: jsonb("public_jwk").notNull(),
    privateJwk: jsonb("private_jwk").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    index("jwks_key_status_idx").on(table.status),
    index("jwks_key_created_at_idx").on(table.createdAt),
  ],
);
