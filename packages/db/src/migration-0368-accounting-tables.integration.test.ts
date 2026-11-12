import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;

const BASE = {
  product: "bid",
  legal_entity: "london_auction_xchange",
  kind: "invoice",
  lax_reference: "LAX-BID-INV-1",
  source_event_ref: "evt-1",
  payload: "{}",
  net_pence: 1000,
  vat_pence: 200,
  gross_pence: 1200,
};

type Row = Record<string, unknown>;

/** Every probe runs in a savepoint inside one transaction that is rolled back at the end. */
describe.skipIf(!url)("migration 0368 accounting tables (database)", { timeout: 30_000 }, () => {
  let client: pg.Client;

  async function accepts(table: string, row: Row): Promise<boolean> {
    const columns = Object.keys(row);
    await client.query("savepoint probe");
    try {
      await client.query(
        `insert into ${table} (${columns.map((c) => `"${c}"`).join(", ")}) values (${columns
          .map((_, i) => `$${i + 1}`)
          .join(", ")})`,
        Object.values(row),
      );
      return true;
    } catch {
      return false;
    } finally {
      await client.query("rollback to savepoint probe");
    }
  }
  const document = (patch: Row) => accepts("accounting_document", { ...BASE, ...patch });

  const LEASE = { lease_token: "t", lease_expires_at: "2030-01-01T00:00:00Z" };
  const ISSUED = { provider: "books", provider_id: "p1", provider_number: "INV-1" };

  beforeAll(async () => {
    if (!url) return;
    client = new Client(buildPgConnectionConfig(url));
    await client.connect();
    await client.query("begin");
  });
  afterAll(async () => {
    if (!client) return;
    await client.query("rollback");
    await client.end();
  });

  it("accepts one legal row for every status", async () => {
    expect(await document({})).toBe(true);
    expect(await document({ state: "sending", attempts: 1, provider: "books", ...LEASE })).toBe(
      true,
    );
    expect(await document({ state: "issued", ...ISSUED, pdf_ref: "pdf" })).toBe(true);
    expect(
      await document({
        state: "unknown",
        attempts: 1,
        provider: "books",
        settles_at: "2030-01-01T00:01:00Z",
      }),
    ).toBe(true);
    expect(
      await document({
        state: "needs_review",
        attempts: 1,
        provider: "books",
        review_lookup: "owed",
        settles_at: "2030-01-01T00:01:00Z",
        needs_review_reason: "two documents",
      }),
    ).toBe(true);
    expect(
      await document({
        state: "needs_review",
        review_lookup: "clear",
        needs_review_reason: "total differs",
        ...ISSUED,
        mismatch_field: "grossPence",
        mismatch_difference_pence: -1,
      }),
    ).toBe(true);
    expect(
      await document({
        state: "failed",
        attempts: 1,
        provider: "xero",
        last_error_class: "rejected",
      }),
    ).toBe(true);
    expect(await document({ state: "cancelled" })).toBe(true);
  });

  it("refuses combinations the domain cannot express", async () => {
    // sending without a lease, a lease on a pending document, a half lease
    expect(await document({ state: "sending" })).toBe(false);
    expect(await document({ ...LEASE })).toBe(false);
    expect(await document({ state: "sending", lease_token: "t" })).toBe(false);
    expect(
      await document({ state: "sending", lease_token: "", lease_expires_at: "2030-01-01" }),
    ).toBe(false);
    // issued without the provider's document, or a document on a pending record, or half of one
    expect(await document({ state: "issued" })).toBe(false);
    expect(await document({ ...ISSUED })).toBe(false);
    expect(await document({ state: "issued", provider: "books", provider_id: "p1" })).toBe(false);
    expect(await document({ state: "issued", provider_id: "p1", provider_number: "n" })).toBe(
      false,
    );
    expect(await document({ pdf_ref: "pdf" })).toBe(false);
    // unknown owes a settle time; nothing else has one
    expect(await document({ state: "unknown" })).toBe(false);
    expect(await document({ settles_at: "2030-01-01" })).toBe(false);
    expect(
      await document({ state: "failed", last_error_class: "x", settles_at: "2030-01-01" }),
    ).toBe(false);
    // needs_review says whether a lookup is owed and why; an owed lookup holds no provider document
    expect(await document({ state: "needs_review", needs_review_reason: "x" })).toBe(false);
    expect(await document({ state: "needs_review", review_lookup: "clear" })).toBe(false);
    expect(
      await document({ state: "needs_review", review_lookup: "owed", needs_review_reason: "x" }),
    ).toBe(false);
    expect(
      await document({
        state: "needs_review",
        review_lookup: "owed",
        needs_review_reason: "x",
        settles_at: "2030-01-01",
        ...ISSUED,
      }),
    ).toBe(false);
    expect(await document({ review_lookup: "clear" })).toBe(false);
    // a mismatch needs the document, and a field and a difference together
    expect(
      await document({
        state: "needs_review",
        review_lookup: "clear",
        needs_review_reason: "x",
        mismatch_field: "netPence",
        mismatch_difference_pence: 1,
      }),
    ).toBe(false);
    expect(
      await document({
        state: "needs_review",
        review_lookup: "clear",
        needs_review_reason: "x",
        ...ISSUED,
        mismatch_field: "netPence",
      }),
    ).toBe(false);
    // failed says why
    expect(await document({ state: "failed" })).toBe(false);
    // an issued document cannot also be in review's lookup, or carry an unknown state
    expect(await document({ state: "done" })).toBe(false);
  });

  it("D1: refuses a totals mismatch on any row but a reviewed one holding the provider's document", async () => {
    const mismatch = { mismatch_field: "netPence", mismatch_difference_pence: 1 };
    // The NULL hole: an issued row has no review_lookup, so `review_lookup = 'clear'` was NULL.
    expect(await document({ state: "issued", ...ISSUED, ...mismatch })).toBe(false);
    expect(
      await document({
        state: "needs_review",
        review_lookup: "clear",
        needs_review_reason: "x",
        attempts: 1,
        ...ISSUED,
        ...mismatch,
      }),
    ).toBe(true);
    expect(await document({ ...mismatch })).toBe(false);
  });

  it("D2: a row that was or may have been sent names its provider", async () => {
    const at = "2030-01-01T00:01:00Z";
    expect(await document({ state: "sending", attempts: 1, ...LEASE })).toBe(false);
    expect(await document({ state: "unknown", attempts: 1, settles_at: at })).toBe(false);
    expect(await document({ state: "failed", attempts: 1, last_error_class: "x" })).toBe(false);
    expect(
      await document({
        state: "needs_review",
        attempts: 1,
        review_lookup: "owed",
        needs_review_reason: "x",
        settles_at: at,
      }),
    ).toBe(false);
    // Even a requeued or cancelled document that was sent once keeps its provider.
    expect(await document({ attempts: 1 })).toBe(false);
    expect(await document({ state: "cancelled", attempts: 2 })).toBe(false);
    expect(await document({ attempts: 1, provider: "xero" })).toBe(true);
    // Never sent: no provider needed.
    expect(await document({})).toBe(true);
    expect(await document({ state: "cancelled" })).toBe(true);
  });

  it("L3: a reference id starts with a letter or digit, as the domain requires", async () => {
    expect(await document({ lax_reference: "LAX-BID-INV-_a" })).toBe(false);
    expect(await document({ lax_reference: "LAX-BID-INV--a" })).toBe(false);
    expect(await document({ lax_reference: "LAX-BID-INV-a_b-c" })).toBe(true);
    expect(await document({ lax_reference: `LAX-BID-INV-${"a".repeat(64)}` })).toBe(true);
    expect(await document({ lax_reference: `LAX-BID-INV-${"a".repeat(65)}` })).toBe(false);
  });

  it("L4: totals follow the domain: contacts carry no money, nothing else is zero, payments no VAT", async () => {
    const contact = { kind: "contact", lax_reference: "LAX-BID-CON-1" };
    const zero = { net_pence: 0, vat_pence: 0, gross_pence: 0 };
    expect(await document({ ...contact, ...zero })).toBe(true);
    expect(await document({ ...contact, net_pence: 100, vat_pence: 20, gross_pence: 120 })).toBe(
      false,
    );
    expect(await document(zero)).toBe(false);
    expect(await document({ ...zero, kind: "credit_note", lax_reference: "LAX-BID-CN-1" })).toBe(
      false,
    );
    const payment = { kind: "payment", lax_reference: "LAX-BID-PAY-1" };
    expect(await document({ ...payment, net_pence: 500, vat_pence: 0, gross_pence: 500 })).toBe(
      true,
    );
    expect(await document({ ...payment, net_pence: 500, vat_pence: 100, gross_pence: 600 })).toBe(
      false,
    );
    expect(await document({ ...payment, ...zero })).toBe(false);
    // A zero-priced line is fine as long as the document is not zero in total.
    expect(
      await document({
        net_pence: 0,
        vat_pence: 0,
        gross_pence: 0,
        kind: "bill",
        lax_reference: "LAX-BID-BILL-1",
      }),
    ).toBe(false);
  });

  it("refuses bad references, entities and money", async () => {
    expect(await document({ lax_reference: "LAX-SHOP-INV-1" })).toBe(false);
    expect(await document({ lax_reference: "LAX-BID-INV-ABC" })).toBe(false);
    expect(await document({ lax_reference: "LAX-BID-PAY-1" })).toBe(false);
    expect(await document({ legal_entity: "london_art_exchange" })).toBe(false);
    expect(
      await document({
        product: "shop",
        legal_entity: "london_auction_xchange",
        lax_reference: "LAX-SHOP-INV-1",
      }),
    ).toBe(false);
    expect(await document({ gross_pence: 1201 })).toBe(false);
    expect(await document({ net_pence: -1, vat_pence: 1201, gross_pence: 1200 })).toBe(false);
    expect(await document({ attempts: -1 })).toBe(false);
    expect(await document({ payload: "[]" })).toBe(false);
  });

  it("refuses two live sources for a product and unknown modes or products", async () => {
    const setting = (patch: Row) =>
      accepts("accounting_source_setting", { product: "bid", ...patch });
    // 'bid' already exists, so probe with an update instead of an insert
    await client.query("savepoint s");
    await expect(
      client.query(
        "update accounting_source_setting set books_mode = 'live' where product = 'bid'",
      ),
    ).rejects.toThrow(/accounting_source_setting_one_live_ck/);
    await client.query("rollback to savepoint s");
    await client.query("savepoint s");
    await client.query(
      "update accounting_source_setting set xero_mode = 'off', books_mode = 'live' where product = 'bid'",
    );
    const live = await client.query(
      "select live_source from accounting_source_setting where product = 'bid'",
    );
    expect(live.rows[0]).toEqual({ live_source: "books" });
    await client.query("rollback to savepoint s");
    expect(await setting({ product: "other" })).toBe(false);
    await client.query("savepoint s");
    await expect(
      client.query(
        "update accounting_source_setting set xero_mode = 'maybe' where product = 'shop'",
      ),
    ).rejects.toThrow(/accounting_source_setting_xero_mode_ck/);
    await client.query("rollback to savepoint s");
  });

  it("is seeded with today's reality and Books off everywhere", async () => {
    const rows = await client.query(
      "select product, xero_mode, books_mode, live_source from accounting_source_setting order by product",
    );
    expect(rows.rows).toEqual([
      { product: "bid", xero_mode: "live", books_mode: "off", live_source: "xero" },
      { product: "lax_art", xero_mode: "off", books_mode: "off", live_source: "none" },
      { product: "shop", xero_mode: "off", books_mode: "off", live_source: "none" },
    ]);
  });
});
