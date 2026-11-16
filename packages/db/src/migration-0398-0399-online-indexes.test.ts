import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { domainEvent } from "./schema/domain-events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
/** The statements, without the explanatory comments. */
const statements = (name: string) => read(name).replace(/^--.*$/gm, "");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};

const MIGRATIONS = [
  {
    number: "0398",
    tag: "0398_domain_events_event_type_aggregate_idx",
    indexes: ["domain_events_event_type_aggregate_id_idx"],
  },
  {
    number: "0399",
    tag: "0399_unapplied_money_shop_payment_idx",
    indexes: [
      "domain_events_unapplied_money_session_idx",
      "domain_events_unapplied_money_intent_idx",
    ],
  },
] as const;

describe("migrations 0398 and 0399 domain_events lookup indexes", () => {
  it("are journalled after 0397, in order, with later times", () => {
    const base = journal.entries.find((e) => e.tag === "0397_enquiry_inbound_replies");
    const first = journal.entries.find((e) => e.tag === MIGRATIONS[0].tag);
    const second = journal.entries.find((e) => e.tag === MIGRATIONS[1].tag);
    expect(first?.when).toBeGreaterThan(base?.when ?? Number.POSITIVE_INFINITY);
    expect(second?.when).toBeGreaterThan(first?.when ?? Number.POSITIVE_INFINITY);
    expect(second?.idx).toBeGreaterThan(first?.idx ?? Number.POSITIVE_INFINITY);
  });

  for (const m of MIGRATIONS) {
    const forward = statements(`${m.tag}.sql`);
    const rollback = read(`${m.number}_rollback.sql`);

    it(`${m.number} only adds its indexes, idempotently, under the lock timeout`, () => {
      expect(forward).toMatch(/^SET LOCAL lock_timeout = '5s';$/m);
      // The runner is transactional: CONCURRENTLY would fail inside it. The online build is the
      // operator's out-of-band step documented in the header.
      expect(forward).not.toMatch(/CREATE (UNIQUE )?INDEX CONCURRENTLY/);
      expect(forward).not.toMatch(/^\s*(DROP|ALTER|UPDATE|DELETE|INSERT|GRANT|REVOKE)\b/im);
      expect(forward.match(/CREATE INDEX IF NOT EXISTS/g)).toHaveLength(m.indexes.length);
      for (const name of m.indexes) expect(forward).toContain(`"${name}"`);
      // A failed concurrent pre-build leaves an INVALID index that IF NOT EXISTS would keep.
      expect(forward).toContain("NOT i.indisvalid");
    });

    it(`${m.number} documents the concurrent pre-build for each index`, () => {
      const header = read(`${m.tag}.sql`);
      for (const name of m.indexes) {
        expect(header).toContain(`--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "${name}"`);
      }
    });

    it(`${m.number} has a rollback that drops only its indexes and its ledger row`, () => {
      const when = journal.entries.find((e) => e.tag === m.tag)?.when;
      expect(rollback).toMatch(/^BEGIN;$/m);
      expect(rollback).toMatch(/^COMMIT;$/m);
      for (const name of m.indexes) expect(rollback).toContain(`DROP INDEX IF EXISTS "${name}"`);
      expect(rollback).toContain(
        `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${when};`,
      );
      expect(rollback.replace(/^--.*$/gm, "")).not.toMatch(/DROP (TABLE|COLUMN)|ALTER TABLE/);
    });
  }

  it("declares the indexes in the schema", () => {
    const names = getTableConfig(domainEvent).indexes.map((i) => i.config.name);
    for (const m of MIGRATIONS) for (const name of m.indexes) expect(names).toContain(name);
  });

  it("indexes the payload keys exactly as existsForShopPayment reads them", () => {
    const forward = statements(`${MIGRATIONS[1].tag}.sql`);
    expect(forward).toMatch(
      /\(\("payload"->>'shopCheckoutSessionId'\)\)\s+WHERE "event_type" = 'payment\.unapplied_money_received'/,
    );
    expect(forward).toMatch(
      /\(\("payload"->>'stripePaymentIntentId'\)\)\s+WHERE "event_type" = 'payment\.unapplied_money_received'/,
    );
  });
});
