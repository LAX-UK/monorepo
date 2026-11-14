import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const rollback = read("0385_rollback.sql");
const journal = JSON.parse(read("meta/_journal.json")) as {
  entries: { idx: number; tag: string; when: number }[];
};
const TAG = "0385_accounting_books_status";

describe("migration 0385 Books status check tables (files)", () => {
  it("is journalled last, after 0384, in a journal that stays ordered", () => {
    const entry = journal.entries.find((e) => e.tag === TAG);
    const previous = journal.entries.find((e) => e.tag === "0384_unapplied_money_dedupe_key_uid");
    expect(entry?.idx).toBe((previous?.idx ?? Number.NaN) + 1);
    expect(journal.entries.at(-1)?.tag).toBe(TAG);
    const times = journal.entries.map((e) => e.when);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1] ?? Number.POSITIVE_INFINITY);
    }
  });

  it("has a rollback in one transaction that clears its ledger row", () => {
    expect(rollback).toMatch(/^BEGIN;$/m);
    expect(rollback).toMatch(/^COMMIT;$/m);
    const when = journal.entries.find((e) => e.tag === TAG)?.when;
    expect(rollback).toContain(
      `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${when};`,
    );
  });
});

const OWNER_URL = process.env.DATABASE_URL_OWNER;

async function withOwner<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client(buildPgConnectionConfig(OWNER_URL as string));
  await client.connect();
  try {
    await client.query("BEGIN");
    return await fn(client);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

/** Needs a migrated database (DATABASE_URL_OWNER); every case runs in a transaction rolled back. */
describe.skipIf(!OWNER_URL)("migration 0385 Books status check tables (database)", () => {
  async function seedDocument(client: pg.Client): Promise<string> {
    const id = randomUUID();
    const reference = `LAX-BID-INV-${id.slice(0, 8)}`;
    await client.query(
      `insert into accounting_document
         (id, product, legal_entity, kind, lax_reference, source_event_ref, payload,
          net_pence, vat_pence, gross_pence, state)
       values ($1, 'bid', 'london_auction_xchange', 'invoice', $2, 'test', '{}'::jsonb, 100, 20, 120, 'pending')`,
      [id, reference],
    );
    return id;
  }

  it("keeps the change list append-only, even for the owner", async () => {
    await withOwner(async (client) => {
      const doc = await seedDocument(client);
      await client.query(
        `insert into accounting_books_status_change (document_id, change, to_state) values ($1, 'state_changed', 'void')`,
        [doc],
      );
      await client.query("SAVEPOINT s");
      await expect(
        client.query(`update accounting_books_status_change set to_state = 'paid'`),
      ).rejects.toThrow(/append-only/);
      await client.query("ROLLBACK TO SAVEPOINT s");
      await expect(client.query("delete from accounting_books_status_change")).rejects.toThrow(
        /append-only/,
      );
    });
  });

  it("holds a payment recorded by hand once per document and Books id, and checks its shape", async () => {
    await withOwner(async (client) => {
      const doc = await seedDocument(client);
      const insert = (paymentId: string) =>
        client.query(
          `insert into accounting_books_status_change (document_id, change, books_payment_id, amount_pence)
           values ($1, 'payment_recorded_in_books', $2, 4000)`,
          [doc, paymentId],
        );
      await insert("900");
      await client.query("SAVEPOINT s");
      await expect(insert("900")).rejects.toThrow(/accounting_books_status_change_payment_uid/);
      await client.query("ROLLBACK TO SAVEPOINT s");
      await expect(insert("not-a-books-id")).rejects.toThrow(/shape_ck/);
    });
  });

  it("refuses a state LAX does not know and a read without its time", async () => {
    await withOwner(async (client) => {
      const doc = await seedDocument(client);
      await client.query("SAVEPOINT s");
      await expect(
        client.query(
          `insert into accounting_books_status (document_id, books_state, checked_at) values ($1, 'refunded', now())`,
          [doc],
        ),
      ).rejects.toThrow(/state_ck/);
      await client.query("ROLLBACK TO SAVEPOINT s");
      await expect(
        client.query(
          `insert into accounting_books_status (document_id, books_state) values ($1, 'void')`,
          [doc],
        ),
      ).rejects.toThrow(/read_pair_ck/);
    });
  });
});
