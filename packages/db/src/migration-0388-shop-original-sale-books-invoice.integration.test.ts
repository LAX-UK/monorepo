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
const migration = read("0388_shop_original_sale_books_invoice.sql").replace(
  /^--> statement-breakpoint$/gm,
  "",
);
const rollbackBody = read("0388_rollback.sql").replace(/^BEGIN;$|^COMMIT;$/gm, "");

/** Everything runs inside one transaction that is rolled back at the end. */
describe.skipIf(!url)(
  "migration 0388 Shop originals invoiced in Books (database)",
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
         values ($1, 'm0388-' || gen_random_uuid()) returning id`,
        [artistParty],
      );
      const artwork = await client.query<{ id: string }>(
        `insert into shop_artwork (artist_id, title, slug, eligible_for_edition_allocation, import_key)
         values ($1, 'M0388 work', 'm0388-' || gen_random_uuid(), false, 'm0388-' || gen_random_uuid())
         returning id`,
        [artist.rows[0]?.id],
      );
      const row = await client.query<{ id: string }>(
        `insert into shop_original_sale
           (artwork_id, buyer_party_id, sale_price_pence, recorded_by_subject_id, status, invoice_issuer)
         values ($1, $2, 125000, 'staff:m0388', 'invoiced', $3) returning id`,
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
        "insert into shop_party (display_name) values ('M0388 Artist'), ('M0388 Buyer') returning id",
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

    it("keeps which sales Books invoices, their links, numbers and payments through a rollback", async () => {
      const id = await sale("books");
      await client.query(
        `update shop_original_sale
            set stripe_payment_link_id = 'plink_M0388_rb', stripe_checkout_session_id = 'cs_M0388_rb',
                stripe_payment_intent_id = 'pi_M0388_rb', invoice_recipient_email = 'b@m0388.test',
                invoice_recipient_name = 'M0388 Buyer', paid_at = now()
          where id = $1`,
        [id],
      );
      const open = await sale("books");
      await client.query(
        "update shop_original_sale set stripe_payment_link_id = 'plink_M0388_open' where id = $1",
        [open],
      );
      const before = await client.query("select * from shop_original_sale where id = any($1)", [
        [id, open],
      ]);
      const counted = await counter();
      // Down and up again, as a deploy after a rollback would.
      await client.query(rollbackBody);
      await client.query(migration);
      const after = await client.query("select * from shop_original_sale where id = any($1)", [
        [id, open],
      ]);
      expect(after.rows).toEqual(before.rows);
      expect(after.rows.find((r) => r.id === id)).toMatchObject({
        invoice_issuer: "books",
        stripe_payment_link_id: "plink_M0388_rb",
        stripe_checkout_session_id: "cs_M0388_rb",
        invoice_number: `LAX-INV-${String(counted).padStart(6, "0")}`,
      });
      expect(after.rows.find((r) => r.id === open)).toMatchObject({
        invoice_issuer: "books",
        stripe_payment_link_id: "plink_M0388_open",
        invoice_number: null,
      });
      expect(await counter()).toBe(counted);
    });

    it("answers which original sale holds a PaymentIntent, as its owner, with the sale id only", async () => {
      const fn = await client.query<{ prosecdef: boolean; proconfig: string[]; returns: string }>(
        `select prosecdef, proconfig, prorettype::regtype::text as returns
           from pg_proc where oid = 'public.accounting_stripe_shop_original_sale(text)'::regprocedure`,
      );
      expect(fn.rows).toEqual([
        { prosecdef: true, proconfig: ["search_path=pg_catalog, public"], returns: "uuid" },
      ]);
      const id = await sale("books");
      await client.query(
        "update shop_original_sale set stripe_payment_intent_id = 'pi_M0388_fn' where id = $1",
        [id],
      );
      const found = await client.query<{ id: string | null }>(
        "select accounting_stripe_shop_original_sale($1) as id",
        ["pi_M0388_fn"],
      );
      expect(found.rows[0]?.id).toBe(id);
      const missing = await client.query<{ id: string | null }>(
        "select accounting_stripe_shop_original_sale($1) as id",
        ["pi_M0388_none"],
      );
      expect(missing.rows[0]?.id).toBeNull();
    });

    it("lets one Checkout Session or PaymentIntent pay one sale only", async () => {
      const [a, b] = [await sale("books"), await sale("books")];
      for (const column of ["stripe_checkout_session_id", "stripe_payment_intent_id"]) {
        await client.query(
          `update shop_original_sale set ${column} = 'x_M0388_once' where id = $1`,
          [a],
        );
        expect(
          await attempt(`update shop_original_sale set ${column} = 'x_M0388_once' where id = $1`, [
            b,
          ]),
        ).toBe("23505");
      }
    });

    it("refuses an unknown issuer and a payment link used by two sales", async () => {
      const id = await sale("books");
      expect(
        await attempt("update shop_original_sale set invoice_issuer = 'xero' where id = $1", [id]),
      ).toBe("23514");
      const other = await sale("books");
      await client.query(
        "update shop_original_sale set stripe_payment_link_id = 'plink_M0388' where id = $1",
        [id],
      );
      expect(
        await attempt(
          "update shop_original_sale set stripe_payment_link_id = 'plink_M0388' where id = $1",
          [other],
        ),
      ).toBe("23505");
    });
  },
);
