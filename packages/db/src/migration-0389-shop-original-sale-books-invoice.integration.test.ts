import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(__dirname, "../drizzle", name), "utf8");
const migration = read("0389_shop_original_sale_books_invoice.sql").replace(
  /^--> statement-breakpoint$/gm,
  "",
);
const rollbackBody = read("0389_rollback.sql").replace(/^BEGIN;$|^COMMIT;$/gm, "");

/** Everything runs inside one transaction that is rolled back at the end. */
describe.skipIf(!url)(
  "migration 0389 Shop originals invoiced in Books (database)",
  { timeout: 60_000 },
  () => {
    let client: pg.Client;
    let artistParty: string;
    let buyerParty: string;
    const attempt = async (sql: string, params: unknown[] = []): Promise<string | null> => {
      await client.query("savepoint s");
      try {
        await client.query(sql, params);
        await client.query("release savepoint s");
        return null;
      } catch (err) {
        await client.query("rollback to savepoint s");
        return (err as { code?: string }).code ?? "unknown";
      }
    };
    const sale = async (issuer: "stripe" | "books"): Promise<string> => {
      const artist = await client.query<{ id: string }>(
        `insert into shop_artist (party_id, slug)
         values ($1, 'm0389-' || gen_random_uuid()) returning id`,
        [artistParty],
      );
      const artwork = await client.query<{ id: string }>(
        `insert into shop_artwork (artist_id, title, slug, eligible_for_edition_allocation, import_key)
         values ($1, 'M0389 work', 'm0389-' || gen_random_uuid(), false, 'm0389-' || gen_random_uuid())
         returning id`,
        [artist.rows[0]?.id],
      );
      const row = await client.query<{ id: string }>(
        `insert into shop_original_sale
           (artwork_id, buyer_party_id, sale_price_pence, recorded_by_subject_id, status, invoice_issuer)
         values ($1, $2, 125000, 'staff:m0389', 'invoiced', $3) returning id`,
        [artwork.rows[0]?.id, buyerParty, issuer],
      );
      return row.rows[0]?.id as string;
    };
    const number = async (id: string) =>
      (
        await client.query<{ invoice_number: string | null }>(
          "select invoice_number from shop_original_sale where id = $1",
          [id],
        )
      ).rows[0]?.invoice_number ?? null;
    const counter = async () =>
      Number(
        (await client.query<{ n: number }>("select last_number as n from shop_invoice_counter"))
          .rows[0]?.n,
      );

    beforeAll(async () => {
      client = new Client(buildPgConnectionConfig(url as string));
      await client.connect();
      await client.query("begin");
      // Down and up again, as a deploy after a rollback would.
      await client.query(rollbackBody);
      await client.query(migration);
      await client.query(
        "insert into shop_invoice_counter (id, last_number) values (1, 0) on conflict (id) do nothing",
      );
      const parties = await client.query<{ id: string }>(
        "insert into shop_party (display_name) values ('M0389 Artist'), ('M0389 Buyer') returning id",
      );
      artistParty = parties.rows[0]?.id as string;
      buyerParty = parties.rows[1]?.id as string;
    });

    afterAll(async () => {
      await client.query("rollback");
      await client.end();
    });

    it("numbers a Books sale from the Shop's counter when it is paid, and never twice", async () => {
      const id = await sale("books");
      expect(await number(id)).toBeNull();
      const before = await counter();
      await client.query("update shop_original_sale set paid_at = now() where id = $1", [id]);
      expect(await number(id)).toBe(`LAX-INV-${String(before + 1).padStart(6, "0")}`);
      await client.query("update shop_original_sale set paid_at = now() where id = $1", [id]);
      expect(await number(id)).toBe(`LAX-INV-${String(before + 1).padStart(6, "0")}`);
      expect(await counter()).toBe(before + 1);
    });

    it("gives a Stripe-invoiced sale no LAX number, and takes none from the counter", async () => {
      const id = await sale("stripe");
      const before = await counter();
      await client.query("update shop_original_sale set paid_at = now() where id = $1", [id]);
      expect(await number(id)).toBeNull();
      expect(await counter()).toBe(before);
      expect(
        await attempt(
          "update shop_original_sale set invoice_number = 'LAX-INV-999999' where id = $1",
          [id],
        ),
      ).toBe("23514");
    });

    it("gives the number back when the payment rolls back", async () => {
      const id = await sale("books");
      const before = await counter();
      expect(
        await attempt(
          "update shop_original_sale set paid_at = now(), sale_price_pence = -1 where id = $1",
          [id],
        ),
      ).toBe("23514");
      expect(await counter()).toBe(before);
      expect(await number(id)).toBeNull();
    });

    it("refuses an unknown issuer and a payment link used by two sales", async () => {
      const id = await sale("books");
      expect(
        await attempt("update shop_original_sale set invoice_issuer = 'xero' where id = $1", [id]),
      ).toBe("23514");
      const other = await sale("books");
      await client.query(
        "update shop_original_sale set stripe_payment_link_id = 'plink_M0389' where id = $1",
        [id],
      );
      expect(
        await attempt(
          "update shop_original_sale set stripe_payment_link_id = 'plink_M0389' where id = $1",
          [other],
        ),
      ).toBe("23505");
    });
  },
);
