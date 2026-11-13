import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const url = process.env.MIGRATION_TEST_DATABASE_URL;
const { Client } = pg;

type Row = Record<string, unknown>;

/** Every probe runs in a savepoint inside one transaction that is rolled back at the end. */
describe.skipIf(!url)("migration 0372 sale seller terms (database)", { timeout: 60_000 }, () => {
  let client: pg.Client;
  let paymentId: string;
  let lotId: string;
  let sellerId: string;
  let agreementId: string;

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

  const terms = (patch: Row) =>
    accepts("sale_seller_terms", {
      payment_id: paymentId,
      lot_id: lotId,
      seller_legal_entity_id: sellerId,
      basis: "held",
      held_reason: "no_agreement",
      hammer_pence: 8_200_000,
      premium_pence: 2_050_000,
      rule_version: "agreement_hammer_v1",
      ...patch,
    });

  const AGREEMENT = () => ({
    basis: "agreement",
    held_reason: null,
    agreement_id: agreementId,
    commission_bps: 1500,
    commission_pence: 1_230_000,
    commission_vat_treatment: "standard",
    commission_vat_bps: 2000,
    commission_vat_pence: 246_000,
    seller_net_pence: 6_724_000,
  });

  beforeAll(async () => {
    if (!url) return;
    client = new Client(buildPgConnectionConfig(url));
    await client.connect();
    await client.query("begin");
    const one = async (text: string, values: unknown[] = []) =>
      (await client.query<{ id: string }>(text, values)).rows[0]?.id as string;
    const userId = `u-${Date.now()}`;
    await client.query(
      `insert into "user" (id, name, email, created_at, updated_at)
       values ($1, 'Seller', $2, now(), now())`,
      [userId, `${userId}@example.test`],
    );
    sellerId = await one(
      `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
       values ('organisation', 'gallery', $1, $2) returning id`,
      [`Seller gallery ${Date.now()}`, userId],
    );
    const buyerId = await one(
      `insert into legal_entity (kind, subkind, display_name, created_by_user_id)
       values ('individual', 'private_collector', $1, $2) returning id`,
      [`Buyer ${Date.now()}`, userId],
    );
    const saleId = await one(
      `insert into sale (title, start_time, end_time, created_by_legal_entity_id)
       values ('Sale', now(), now() + interval '1 day', $1) returning id`,
      [sellerId],
    );
    lotId = await one(
      `insert into lot (sale_id, title, auction_type, starting_price, current_price, start_time, end_time, seller_legal_entity_id)
       values ($1, 'Lot', 'english', 0, 0, now(), now() + interval '1 day', $2) returning id`,
      [saleId, sellerId],
    );
    paymentId = await one(
      `insert into payment (lot_id, buyer_id, buyer_legal_entity_id, seller_legal_entity_id, amount, platform_fee)
       values ($1, $2, $3, $4, 102500, 5125) returning id`,
      [lotId, userId, buyerId, sellerId],
    );
    const submissionId = await one(
      `insert into item_submission (legal_entity_id, title) values ($1, 'Work') returning id`,
      [sellerId],
    );
    agreementId = await one(
      `insert into consignment_agreement (submission_id, legal_entity_id, terms_version, commission_percent)
       values ($1, $2, 'v1', 15) returning id`,
      [submissionId, sellerId],
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.query("rollback");
    await client.end();
  });

  it("accepts a sale paid on an agreement whose figures add up, and refuses one that does not", async () => {
    expect(await terms(AGREEMENT())).toBe(true);
    expect(await terms({ ...AGREEMENT(), seller_net_pence: 6_724_001 })).toBe(false);
    expect(await terms({ ...AGREEMENT(), commission_vat_pence: 245_999 })).toBe(false);
    // Not VAT-registered: no VAT, and the net is the hammer less the commission.
    expect(
      await terms({
        ...AGREEMENT(),
        commission_vat_treatment: "not_registered",
        commission_vat_bps: 0,
        commission_vat_pence: 0,
        seller_net_pence: 6_970_000,
      }),
    ).toBe(true);
    expect(
      await terms({
        ...AGREEMENT(),
        commission_vat_treatment: "not_registered",
        commission_vat_bps: 0,
        seller_net_pence: 6_724_000,
      }),
    ).toBe(false);
  });

  it("refuses a negative net and an agreement row with a missing figure", async () => {
    expect(
      await terms({
        ...AGREEMENT(),
        commission_pence: 9_000_000,
        commission_vat_pence: 0,
        seller_net_pence: -800_000,
      }),
    ).toBe(false);
    expect(await terms({ ...AGREEMENT(), commission_pence: null })).toBe(false);
    expect(await terms({ ...AGREEMENT(), agreement_id: null })).toBe(false);
    expect(await terms({ ...AGREEMENT(), held_reason: "no_agreement" })).toBe(false);
  });

  it("accepts held and LAX-owned rows only without an agreement or figures", async () => {
    expect(await terms({})).toBe(true);
    for (const held_reason of [
      "no_agreement",
      "not_accepted",
      "no_commission",
      "other_seller",
      "vat_setting_missing",
      "negative_net",
      "legacy_invoice",
    ]) {
      expect(await terms({ held_reason }), held_reason).toBe(true);
    }
    expect(await terms({ held_reason: "unknown" })).toBe(false);
    expect(await terms({ held_reason: null })).toBe(false);
    expect(await terms({ agreement_id: agreementId })).toBe(false);
    expect(await terms({ commission_pence: 0 })).toBe(false);
    expect(await terms({ basis: "lax_owned", held_reason: null })).toBe(true);
    expect(await terms({ basis: "lax_owned" })).toBe(false);
    expect(await terms({ basis: "lax_owned", held_reason: null, seller_net_pence: 1 })).toBe(false);
    expect(await terms({ basis: "other", held_reason: null })).toBe(false);
  });

  it("keeps other charges empty and the source and amounts valid", async () => {
    expect(await terms({ other_charges: "[]" })).toBe(true);
    expect(await terms({ other_charges: '[{"label":"Insurance","pence":100}]' })).toBe(false);
    expect(await terms({ other_charges: "{}" })).toBe(false);
    for (const source of ["raised", "recomputed_at_payout", "agreement_recorded"]) {
      expect(await terms({ source }), source).toBe(true);
    }
    expect(await terms({ source: "guess" })).toBe(false);
    expect(await terms({ hammer_pence: -1 })).toBe(false);
    expect(await terms({ premium_pence: -1 })).toBe(false);
    expect(await terms({ legacy_platform_fee_pence: 5_125 })).toBe(true);
    expect(await terms({ legacy_platform_fee_pence: -1 })).toBe(false);
    expect(await terms({ rule_version: "" })).toBe(false);
  });

  it("holds one row per payment", async () => {
    await client.query("savepoint first");
    await client.query(
      `insert into sale_seller_terms (payment_id, lot_id, seller_legal_entity_id, basis, held_reason, hammer_pence, premium_pence, rule_version)
       values ($1, $2, $3, 'held', 'no_agreement', 1, 0, 'agreement_hammer_v1')`,
      [paymentId, lotId, sellerId],
    );
    expect(await terms({})).toBe(false);
    await client.query("rollback to savepoint first");
  });

  it("starts agreements as online, and recorded ones need their signed file and reason", async () => {
    const source = await client.query<{ source: string }>(
      "select source from consignment_agreement where id = $1",
      [agreementId],
    );
    expect(source.rows[0]?.source).toBe("online");
    const agreement = async (patch: Row) => {
      const submission = await client.query<{ id: string }>(
        `insert into item_submission (legal_entity_id, title) values ($1, 'Paper work') returning id`,
        [sellerId],
      );
      return accepts("consignment_agreement", {
        submission_id: submission.rows[0]?.id,
        legal_entity_id: sellerId,
        terms_version: "v1",
        ...patch,
      });
    };
    const upload = await client.query<{ id: string }>(
      `insert into upload_object (kind, key, declared_content_type, declared_byte_size, expires_at, owner_user_id)
       values ('consignment_agreement', $1, 'application/pdf', 10, now() + interval '1 day', (select id from "user" limit 1))
       returning id`,
      [`k-${Date.now()}`],
    );
    const document = upload.rows[0]?.id;
    expect(await agreement({})).toBe(true);
    expect(await agreement({ source: "recorded" })).toBe(false);
    expect(await agreement({ source: "recorded", signed_document_id: document })).toBe(false);
    expect(
      await agreement({
        source: "recorded",
        signed_document_id: document,
        record_reason: "Signed on paper",
      }),
    ).toBe(true);
    expect(
      await agreement({ source: "recorded", signed_document_id: document, record_reason: "" }),
    ).toBe(false);
    expect(await agreement({ source: "online", record_reason: "x" })).toBe(false);
    expect(await agreement({ source: "paper" })).toBe(false);
  });

  it("starts the Bid company's VAT setting as standard and allows only known values", async () => {
    const seeded = await client.query<{ value: string }>(
      "select value from bid_finance_setting where key = 'commission_vat_treatment'",
    );
    expect(seeded.rows[0]?.value).toBe("standard");
    expect(
      await accepts("bid_finance_setting", { key: "commission_vat_treatment", value: "x" }),
    ).toBe(false);
    expect(await accepts("bid_finance_setting", { key: "other", value: "x" })).toBe(false);
  });
});
