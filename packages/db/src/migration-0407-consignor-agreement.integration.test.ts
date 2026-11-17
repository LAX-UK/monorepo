import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
/** The file as one script inside the test's transaction: no breakpoints, BEGIN or COMMIT. */
const script = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8")
    .replaceAll("--> statement-breakpoint", "")
    .replace(/^BEGIN;$/m, "")
    .replace(/^COMMIT;$/m, "");

/**
 * Runs against a database migrated to the head. Each test runs in a transaction that is always
 * rolled back, so nothing it writes is left behind.
 */
describe.skipIf(!migrationUrl)(
  "migration 0407 consignor agreement (Postgres)",
  { timeout: 30_000 },
  () => {
    let client: pg.Client;
    let registerId: string;
    let partyId: string;
    let otherPartyId: string;

    beforeAll(async () => {
      client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
      await client.connect();
    });

    afterAll(async () => {
      await client.end();
    });

    beforeEach(async () => {
      await client.query("BEGIN");
      const row = await client.query<{ id: string }>(
        `insert into artwork_register (zoho_product_id, stock_code, kind, title, artist_name, artist_code)
         values ('cons-mig-1', 'LAX-ORI-AAA-CON-26-0001', 'original', 'Work', 'Artist', 'AAA')
         returning id`,
      );
      registerId = row.rows[0]?.id as string;
      const parties = await client.query<{ id: string }>(
        `insert into shop_party (display_name, kind) values ('Consignor one', 'person'),
           ('Consignor two', 'person') returning id`,
      );
      partyId = parties.rows[0]?.id as string;
      otherPartyId = parties.rows[1]?.id as string;
    });

    afterEach(async () => {
      await client.query("ROLLBACK");
    });

    type Terms = Partial<{
      id: string;
      agreement_id: string;
      version: number;
      party_id: string;
      replaces_id: string | null;
      covers_lax_bid: boolean;
      covers_lax_art: boolean;
      covers_private_sale: boolean;
      starts_on: string;
      ends_on: string | null;
      lowest_price_pence: number | null;
      commission_basis_points: number | null;
      signed_file_key: string;
      note: string | null;
    }>;

    function agreementRow(terms: Terms = {}) {
      const id = terms.id ?? randomUUID();
      return {
        id,
        agreement_id: id,
        version: 1,
        party_id: partyId,
        replaces_id: null,
        covers_lax_bid: true,
        covers_lax_art: true,
        covers_private_sale: false,
        starts_on: "2026-03-03",
        ends_on: "2027-03-02",
        lowest_price_pence: 200000,
        commission_basis_points: 2500,
        signed_file_key: "consignor-agreements/one/signed.pdf",
        note: null,
        ...terms,
      };
    }

    async function insertAgreement(terms: Terms = {}): Promise<string> {
      const row = agreementRow(terms);
      const columns = Object.keys(row);
      await client.query(
        `insert into consignor_agreement (${columns.join(", ")}, created_by)
         values (${columns.map((_, i) => `$${i + 1}`).join(", ")}, 'staff:s1')`,
        Object.values(row),
      );
      return row.id;
    }

    /** Runs the statement and returns "<SQLSTATE>: <message>" of the refusal; fails if it ran. */
    async function refused(sql: string, params: unknown[] = []): Promise<string> {
      await client.query("SAVEPOINT attempt");
      try {
        await client.query(sql, params);
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT attempt");
        const { code, message } = error as { code?: string; message: string };
        return `${code}: ${message}`;
      }
      throw new Error(`expected refusal: ${sql}`);
    }

    async function refusedAgreement(terms: Terms): Promise<string> {
      await client.query("SAVEPOINT attempt_insert");
      try {
        await insertAgreement(terms);
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT attempt_insert");
        const { code, message } = error as { code?: string; message: string };
        return `${code}: ${message}`;
      }
      throw new Error(`expected refusal: ${JSON.stringify(terms)}`);
    }

    it("accepts an agreement and refuses terms outside the rules", async () => {
      await insertAgreement();
      for (const terms of [
        { covers_lax_bid: false, covers_lax_art: false, covers_private_sale: false },
        { ends_on: "2026-03-02" },
        { lowest_price_pence: 0 },
        { commission_basis_points: 10001 },
        { signed_file_key: "../escape.pdf" },
        { signed_file_key: "a//b.pdf" },
        { signed_file_key: "with space.pdf" },
        { note: " padded " },
        { note: "n".repeat(1001) },
      ] satisfies Terms[]) {
        expect(await refusedAgreement(terms), JSON.stringify(terms)).toMatch(/^23514/);
      }
    });

    it("refuses a first version whose agreement id is not its own, and a party that does not exist", async () => {
      expect(await refusedAgreement({ agreement_id: randomUUID() })).toMatch(/^23514/);
      expect(await refusedAgreement({ party_id: randomUUID() })).toMatch(/^23503/);
    });

    it("replaces a version with the next one and keeps one current version", async () => {
      const first = await insertAgreement();
      // A second current version of the same agreement is refused.
      expect(
        await refusedAgreement({
          id: randomUUID(),
          agreement_id: first,
          version: 2,
          replaces_id: first,
        }),
      ).toMatch(/^23505/);
      await client.query(
        `update consignor_agreement set status = 'replaced', replaced_at = now() where id = $1`,
        [first],
      );
      await insertAgreement({
        id: randomUUID(),
        agreement_id: first,
        version: 2,
        replaces_id: first,
        lowest_price_pence: 250000,
      });
      const rows = await client.query<{ version: number; status: string }>(
        "select version, status from consignor_agreement where agreement_id = $1 order by version",
        [first],
      );
      expect(rows.rows).toEqual([
        { version: 1, status: "replaced" },
        { version: 2, status: "current" },
      ]);
    });

    it("refuses a version that does not continue the one it replaces", async () => {
      const first = await insertAgreement();
      await client.query(
        `update consignor_agreement set status = 'replaced', replaced_at = now() where id = $1`,
        [first],
      );
      // Another consignor, or a skipped number.
      expect(
        await refusedAgreement({
          id: randomUUID(),
          agreement_id: first,
          version: 2,
          replaces_id: first,
          party_id: otherPartyId,
        }),
      ).toMatch(/does not continue/);
      expect(
        await refusedAgreement({
          id: randomUUID(),
          agreement_id: first,
          version: 3,
          replaces_id: first,
        }),
      ).toMatch(/does not continue/);
    });

    it("never edits an agreement in place, deletes it or truncates the table", async () => {
      const id = await insertAgreement();
      expect(
        await refused("update consignor_agreement set lowest_price_pence = 1 where id = $1", [id]),
      ).toMatch(/never edited in place \(UPDATE/);
      expect(
        await refused(
          `update consignor_agreement set status = 'retired', retired_at = now(), retired_by = 's',
             note = 'changed' where id = $1`,
          [id],
        ),
      ).toMatch(/never edited in place/);
      expect(await refused("delete from consignor_agreement where id = $1", [id])).toMatch(
        /never edited in place \(DELETE/,
      );
      expect(await refused("truncate consignor_agreement")).toMatch(
        /never edited in place \(TRUNCATE/,
      );
      // Retiring needs the time and who retired it, and is then final.
      expect(
        await refused(`update consignor_agreement set status = 'retired' where id = $1`, [id]),
      ).toMatch(/^23514/);
      await client.query(
        `update consignor_agreement set status = 'retired', retired_at = now(), retired_by = 'staff:s1'
          where id = $1`,
        [id],
      );
      expect(
        await refused(
          `update consignor_agreement set status = 'current', retired_at = null, retired_by = null
            where id = $1`,
          [id],
        ),
      ).toMatch(/never edited in place/);
    });

    it("keeps a consignor's agreements when the client is asked to be deleted", async () => {
      await insertAgreement();
      expect(await refused("delete from shop_party where id = $1", [partyId])).toMatch(/^23503/);
    });

    async function link(
      consignor: "client" | "lax",
      party: string | null,
      reason: string | null,
      at: string,
    ) {
      await client.query(
        `insert into artwork_consignor_link (register_id, consignor, party_id, change_reason, set_by, set_at)
         values ($1, $2, $3, $4, 'staff:s1', $5)`,
        [registerId, consignor, party, reason, at],
      );
    }

    it("sets a consignor once without a reason and needs one for every change after", async () => {
      await link("client", partyId, null, "2026-11-17T09:00:00Z");
      expect(
        await refused(
          `insert into artwork_consignor_link (register_id, consignor, set_by, set_at)
           values ($1, 'lax', 'staff:s1', '2026-11-17T10:00:00Z')`,
          [registerId],
        ),
      ).toMatch(/needs a reason/);
      await link("lax", null, "Bought outright", "2026-11-17T10:00:00Z");
      const rows = await client.query<{ consignor: string }>(
        "select consignor from artwork_consignor_link where register_id = $1 order by set_at",
        [registerId],
      );
      expect(rows.rows.map((r) => r.consignor)).toEqual(["client", "lax"]);
    });

    it("names a client only for a client consignor, and keeps reasons tidy", async () => {
      expect(
        await refused(
          `insert into artwork_consignor_link (register_id, consignor, party_id, set_by, set_at)
           values ($1, 'lax', $2, 's', now())`,
          [registerId, partyId],
        ),
      ).toMatch(/^23514/);
      expect(
        await refused(
          `insert into artwork_consignor_link (register_id, consignor, set_by, set_at)
           values ($1, 'client', 's', now())`,
          [registerId],
        ),
      ).toMatch(/^23514/);
      expect(
        await refused(
          `insert into artwork_consignor_link (register_id, consignor, change_reason, set_by, set_at)
           values ($1, 'lax', ' padded ', 's', now())`,
          [registerId],
        ),
      ).toMatch(/^23514/);
    });

    it("keeps consignor links append-only, truncation included", async () => {
      await link("client", partyId, null, "2026-11-17T09:00:00Z");
      expect(
        await refused(
          "update artwork_consignor_link set change_reason = 'x' where register_id = $1",
          [registerId],
        ),
      ).toMatch(/append-only \(UPDATE/);
      expect(
        await refused("delete from artwork_consignor_link where register_id = $1", [registerId]),
      ).toMatch(/append-only \(DELETE/);
      expect(await refused("truncate artwork_consignor_link")).toMatch(/append-only \(TRUNCATE/);
      // Two changes of one artwork are never stamped at the same time.
      expect(
        await refused(
          `insert into artwork_consignor_link (register_id, consignor, change_reason, set_by, set_at)
           values ($1, 'lax', 'Same time', 's', '2026-11-17T09:00:00Z')`,
          [registerId],
        ),
      ).toMatch(/^23505/);
    });

    it("rolls back twice in a row and applies again", async () => {
      await client.query(script("0407_rollback.sql"));
      for (const table of ["consignor_agreement", "artwork_consignor_link"]) {
        expect((await client.query("select to_regclass($1) as t", [table])).rows[0]?.t).toBe(null);
      }
      await client.query(script("0407_rollback.sql"));
      await client.query(script("0407_consignor_agreement.sql"));
      await insertAgreement();
    });

    it("refuses to roll back while an agreement or a consignor exists", async () => {
      await client.query("SAVEPOINT with_link");
      await link("lax", null, null, "2026-11-17T09:00:00Z");
      expect(await refused(script("0407_rollback.sql"))).toMatch(/holds consignors/);
      await client.query("ROLLBACK TO SAVEPOINT with_link");
      await insertAgreement();
      expect(await refused(script("0407_rollback.sql"))).toMatch(/holds agreements/);
    });
  },
);
