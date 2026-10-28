import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildPgConnectionConfig } from "./ssl.js";

const migrationUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const drizzleDir = join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
const read = (name: string) =>
  readFileSync(join(drizzleDir, name), "utf8").replaceAll("--> statement-breakpoint", "");

/**
 * Runs inside one transaction that is always rolled back. Each probe sits in a savepoint so a
 * refused row does not end the transaction.
 */
describe.skipIf(!migrationUrl)("migration 0246 edition runs", { timeout: 30_000 }, () => {
  let client: pg.Client;
  let artistId: string;

  async function accepts(sql: string, params: unknown[] = []): Promise<boolean> {
    await client.query("savepoint probe");
    try {
      await client.query(sql, params);
      return true;
    } catch {
      return false;
    } finally {
      await client.query("rollback to savepoint probe");
    }
  }

  let serial = 0;
  async function insertArtwork(columns: Record<string, unknown>): Promise<string> {
    serial += 1;
    const values: Record<string, unknown> = {
      slug: `run-${serial}-${Date.now()}`,
      title: "Probe",
      artist_id: artistId,
      eligible_for_edition_allocation: false,
      import_key: `probe:${serial}:${Date.now()}`,
      ...columns,
    };
    const names = Object.keys(values);
    const { rows } = await client.query(
      `insert into shop_artwork (${names.map((n) => `"${n}"`).join(", ")})
       values (${names.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
      Object.values(values),
    );
    return rows[0].id as string;
  }

  function artworkProbe(columns: Record<string, unknown>): { sql: string; params: unknown[] } {
    serial += 1;
    const values: Record<string, unknown> = {
      slug: `probe-${serial}-${Date.now()}`,
      title: "Probe",
      artist_id: artistId,
      eligible_for_edition_allocation: true,
      import_key: `probe:${serial}:${Date.now()}`,
      ...columns,
    };
    const names = Object.keys(values);
    return {
      sql: `insert into shop_artwork (${names.map((n) => `"${n}"`).join(", ")})
            values (${names.map((_, i) => `$${i + 1}`).join(", ")})`,
      params: Object.values(values),
    };
  }

  const limited = (extra: Record<string, unknown> = {}) => ({
    run_kind: "limited",
    run_role: "main",
    run_template: "custom",
    run_size: 40,
    alloc_buyer: 0,
    alloc_artist: 30,
    alloc_lax: 10,
    ...extra,
  });

  beforeAll(async () => {
    client = new pg.Client(buildPgConnectionConfig(migrationUrl as string));
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client.query("rollback");
    await client.query("begin");
    const party = await client.query(
      "insert into shop_party (display_name, kind) values ('Probe artist', 'artist') returning id",
    );
    const artist = await client.query(
      "insert into shop_artist (party_id, slug) values ($1, $2) returning id",
      [party.rows[0].id, `probe-artist-${Date.now()}`],
    );
    artistId = artist.rows[0].id as string;
  });

  describe("artwork runs", () => {
    it("accepts originals with no run and the run shapes the plan describes", async () => {
      for (const columns of [
        { eligible_for_edition_allocation: false },
        limited(),
        limited({ run_size: 2, alloc_artist: 1, alloc_lax: 1 }),
        limited({ run_size: 500, alloc_artist: 250, alloc_lax: 250 }),
        limited({
          run_template: "lax_standard",
          run_size: 24,
          alloc_buyer: 10,
          alloc_artist: 10,
          alloc_lax: 4,
        }),
        { run_kind: "open", run_role: "main", open_default_artist_pct: 50 },
      ]) {
        const probe = artworkProbe(columns);
        expect(await accepts(probe.sql, probe.params), JSON.stringify(columns)).toBe(true);
      }
    });

    it.each([
      ["a size of 1 (rule 1)", limited({ run_size: 1, alloc_artist: 1, alloc_lax: 0 })],
      ["a size of 501 (rule 1)", limited({ run_size: 501, alloc_artist: 500, alloc_lax: 1 })],
      ["a standard run that is not 24 (rule 1)", limited({ run_template: "lax_standard" })],
      [
        "a standard run with another split (rule 1)",
        limited({
          run_template: "lax_standard",
          run_size: 24,
          alloc_buyer: 0,
          alloc_artist: 20,
          alloc_lax: 4,
        }),
      ],
      ["an allocation that does not add up (rule 2)", limited({ alloc_artist: 29 })],
      ["a negative allocation (rule 2)", limited({ alloc_artist: 41, alloc_lax: -1 })],
      ["buyer prints with no original (rule 3)", limited({ alloc_buyer: 10, alloc_artist: 20 })],
      [
        "no artist or LAX print (rule 4)",
        limited({ run_size: 4, alloc_buyer: 4, alloc_artist: 0, alloc_lax: 0 }),
      ],
      [
        "an open run with a size (rule 5)",
        { run_kind: "open", run_role: "main", open_default_artist_pct: 50, run_size: 5 },
      ],
      [
        "an open run with buyer prints (rule 5)",
        { run_kind: "open", run_role: "main", open_default_artist_pct: 50, alloc_buyer: 1 },
      ],
      ["an open run with no split (rule 5)", { run_kind: "open", run_role: "main" }],
      [
        "an open split above 100 (rule 5)",
        { run_kind: "open", run_role: "main", open_default_artist_pct: 101 },
      ],
      ["a limited run with an open split", limited({ open_default_artist_pct: 50 })],
      ["an unknown run kind", { run_kind: "unlimited", run_role: "main" }],
      ["a run kind with no role", { run_kind: "open", open_default_artist_pct: 50 }],
      ["a role with no run kind", { run_role: "main" }],
      ["a custom limited run with no template", limited({ run_template: null })],
      [
        "a proof with no type",
        limited({
          run_template: null,
          run_role: "proof",
          run_size: 3,
          alloc_artist: 3,
          alloc_lax: 0,
        }),
      ],
    ])("refuses %s", async (_name, columns) => {
      const probe = artworkProbe(columns);
      expect(await accepts(probe.sql, probe.params)).toBe(false);
    });

    it("allows buyer prints once the run links to an original (rule 3)", async () => {
      const original = await insertArtwork({});
      const probe = artworkProbe(
        limited({ alloc_buyer: 10, alloc_artist: 20, source_original_artwork_id: original }),
      );
      expect(await accepts(probe.sql, probe.params)).toBe(true);
    });

    it("links proofs and companions to a main run and refuses a self-link", async () => {
      const main = await insertArtwork(limited());
      const proof = limited({
        run_template: null,
        run_role: "proof",
        proof_type: "ap",
        run_size: 3,
        alloc_artist: 3,
        alloc_lax: 0,
        main_run_artwork_id: main,
      });
      const proofProbe = artworkProbe(proof);
      expect(await accepts(proofProbe.sql, proofProbe.params)).toBe(true);
      const noMain = artworkProbe({ ...proof, main_run_artwork_id: null });
      expect(await accepts(noMain.sql, noMain.params)).toBe(false);
      const companionWithoutLink = artworkProbe(limited({ run_role: "companion" }));
      expect(await accepts(companionWithoutLink.sql, companionWithoutLink.params)).toBe(false);
      expect(
        await accepts(
          "update shop_artwork set main_run_artwork_id = id, run_role = 'companion' where id = $1",
          [main],
        ),
      ).toBe(false);
    });

    it("backfills existing artworks with editions as the LAX standard run", async () => {
      await client.query("rollback");
      await client.query("begin");
      // Rewind this artwork to how it looked before the migration, then run the backfill.
      const party = await client.query(
        "insert into shop_party (display_name, kind) values ('Old artist', 'artist') returning id",
      );
      const artist = await client.query(
        "insert into shop_artist (party_id, slug) values ($1, $2) returning id",
        [party.rows[0].id, `old-artist-${Date.now()}`],
      );
      artistId = artist.rows[0].id as string;
      const id = await insertArtwork({ eligible_for_edition_allocation: true });
      const original = await insertArtwork({ eligible_for_edition_allocation: false });
      const backfill = read("0246_shop_edition_runs.sql").match(
        /UPDATE "shop_artwork"[\s\S]*?"run_kind" IS NULL;/,
      );
      expect(backfill).not.toBeNull();
      await client.query("alter table shop_artwork disable trigger all");
      await client.query(
        `update shop_artwork set run_kind = null, run_role = null, run_template = null, run_size = null,
           alloc_buyer = null, alloc_artist = null, alloc_lax = null, proofs_kept_ap = null,
           proofs_kept_pp = null, proofs_kept_hc = null, proofs_kept_bat = null where id = any($1)`,
        [[id, original]],
      );
      await client.query((backfill as RegExpMatchArray)[0]);
      const { rows } = await client.query(
        "select id, run_kind, run_role, run_template, run_size, alloc_buyer, alloc_artist, alloc_lax, proofs_kept_ap from shop_artwork where id = any($1)",
        [[id, original]],
      );
      const byId = new Map(rows.map((row) => [row.id, row]));
      expect(byId.get(id)).toMatchObject({
        run_kind: "limited",
        run_role: "main",
        run_template: "lax_standard",
        run_size: 24,
        alloc_buyer: 10,
        alloc_artist: 10,
        alloc_lax: 4,
        proofs_kept_ap: 0,
      });
      expect(byId.get(original)).toMatchObject({
        run_kind: null,
        run_size: null,
        proofs_kept_ap: null,
      });
    });
  });

  describe("edition facts", () => {
    const facts = (extra: Record<string, unknown> = {}) => ({
      numbering: "on_print",
      signature_kind: "hand_signed",
      signature_medium: "pencil",
      signature_place: "front_lower_margin",
      certificate_kind: "none",
      ...extra,
    });

    async function factsProbe(columns: Record<string, unknown>) {
      const artwork = await insertArtwork({});
      const values = { artwork_id: artwork, ...columns };
      const names = Object.keys(values);
      return {
        sql: `insert into shop_edition_facts (${names.join(", ")}) values (${names.map((_, i) => `$${i + 1}`).join(", ")})`,
        params: Object.values(values),
      };
    }

    const included = {
      certificate_kind: "included",
      certificate_issuer: "artist",
      certificate_form: "paper",
      certificate_arrives: "with_print",
      certificate_numbered_to_match: true,
    };

    it.each([
      ["hand-signed, numbered, no certificate", facts()],
      [
        "an unsigned run",
        facts({
          numbering: "none",
          signature_kind: "unsigned",
          signature_medium: null,
          signature_place: null,
        }),
      ],
      [
        "an estate signature with a place",
        facts({ signature_kind: "estate_signed", signature_medium: null, signature_place: "back" }),
      ],
      [
        "a certificate sent later",
        facts({ ...included, certificate_arrives: "separately", certificate_within_weeks: 4 }),
      ],
      [
        "numbering on a matching certificate (rule 6)",
        facts({
          ...included,
          numbering: "on_certificate",
          signature_kind: "plate_signed",
          signature_medium: null,
          signature_place: null,
        }),
      ],
      [
        "a numbered run with an unmatched certificate and a reason (rule 7)",
        facts({
          ...included,
          certificate_numbered_to_match: false,
          certificate_numbered_to_match_reason: "Lists the whole run",
        }),
      ],
      [
        "an unnumbered run with an unmatched certificate",
        facts({ ...included, numbering: "none", certificate_numbered_to_match: false }),
      ],
    ])("accepts %s", async (_name, columns) => {
      const probe = await factsProbe(columns);
      expect(await accepts(probe.sql, probe.params)).toBe(true);
    });

    it.each([
      ["a hand signature with no medium (rule 8)", facts({ signature_medium: null })],
      ["a hand signature with no place (rule 8)", facts({ signature_place: null })],
      [
        "an estate signature with no place (rule 8)",
        facts({ signature_kind: "estate_signed", signature_medium: null, signature_place: null }),
      ],
      [
        "a plate signature with a place (rule 8)",
        facts({ signature_kind: "plate_signed", signature_medium: null }),
      ],
      [
        "an unsigned print with a medium (rule 8)",
        facts({ signature_kind: "unsigned", signature_place: null }),
      ],
      [
        "numbering on the certificate with no certificate (rule 6)",
        facts({ numbering: "on_certificate" }),
      ],
      [
        "numbering on a certificate not numbered to match (rule 6)",
        facts({
          ...included,
          numbering: "on_certificate",
          certificate_numbered_to_match: false,
          certificate_numbered_to_match_reason: "x",
        }),
      ],
      [
        "a numbered run with an unmatched certificate and no reason (rule 7)",
        facts({ ...included, certificate_numbered_to_match: false }),
      ],
      [
        "a blank reason (rule 7)",
        facts({
          ...included,
          certificate_numbered_to_match: false,
          certificate_numbered_to_match_reason: "  ",
        }),
      ],
      ["a certificate with no issuer", facts({ ...included, certificate_issuer: null })],
      ["certificate details with no certificate", facts({ certificate_issuer: "artist" })],
      [
        "a separate certificate with no time",
        facts({ ...included, certificate_arrives: "separately" }),
      ],
      [
        "a time on a certificate that comes with the print",
        facts({ ...included, certificate_within_weeks: 4 }),
      ],
      [
        "a certificate due in 53 weeks",
        facts({ ...included, certificate_arrives: "separately", certificate_within_weeks: 53 }),
      ],
      ["an unknown numbering", facts({ numbering: "stamped" })],
      ["a confirmation with no time", facts({ confirmed_by_subject_id: "staff-1" })],
    ])("refuses %s", async (_name, columns) => {
      const probe = await factsProbe(columns);
      expect(await accepts(probe.sql, probe.params)).toBe(false);
    });

    it("keeps one row of facts per artwork", async () => {
      const artwork = await insertArtwork({});
      const insert =
        "insert into shop_edition_facts (artwork_id, numbering, signature_kind, certificate_kind) values ($1, 'none', 'unsigned', 'none')";
      await client.query(insert, [artwork]);
      expect(await accepts(insert, [artwork])).toBe(false);
    });
  });

  describe("prints", () => {
    /** Writers set the stock reference themselves since 0247; numbered prints use the number. */
    function insertEdition(artwork: string, columns: Record<string, unknown>) {
      const numbered =
        typeof columns.edition_number === "number" ? { stock_ref: columns.edition_number } : {};
      const values = { artwork_id: artwork, allocation: "artist", ...numbered, ...columns };
      const names = Object.keys(values);
      return {
        sql: `insert into shop_edition (${names.join(", ")}) values (${names.map((_, i) => `$${i + 1}`).join(", ")}) returning stock_ref`,
        params: Object.values(values),
      };
    }

    it("keeps an explicit stock reference and allows unnumbered prints", async () => {
      const artwork = await insertArtwork({});
      const probe = insertEdition(artwork, { edition_number: null, stock_ref: 21 });
      const { rows } = await client.query(probe.sql, probe.params);
      expect(rows[0].stock_ref).toBe(21);
    });

    it("refuses a print with no number and no stock reference", async () => {
      const artwork = await insertArtwork({});
      const probe = insertEdition(artwork, { edition_number: null });
      expect(await accepts(probe.sql, probe.params)).toBe(false);
    });

    it("refuses a repeated stock reference or edition number in a run", async () => {
      const artwork = await insertArtwork({});
      const first = insertEdition(artwork, { edition_number: 1 });
      await client.query(first.sql, first.params);
      const sameNumber = insertEdition(artwork, { edition_number: 1 });
      expect(await accepts(sameNumber.sql, sameNumber.params)).toBe(false);
      const sameRef = insertEdition(artwork, { edition_number: null, stock_ref: 1 });
      expect(await accepts(sameRef.sql, sameRef.params)).toBe(false);
    });

    it("refuses a print that has both an edition number and a proof number", async () => {
      const artwork = await insertArtwork({});
      const probe = insertEdition(artwork, { edition_number: 1, proof_number: 1 });
      expect(await accepts(probe.sql, probe.params)).toBe(false);
    });

    it("keeps label codes unique across prints", async () => {
      const artwork = await insertArtwork({});
      const first = insertEdition(artwork, { edition_number: 1, label_code: "K7M2QX" });
      await client.query(first.sql, first.params);
      const duplicate = insertEdition(artwork, { edition_number: 2, label_code: "K7M2QX" });
      expect(await accepts(duplicate.sql, duplicate.params)).toBe(false);
    });
  });

  describe("stock batches", () => {
    const batch = (artwork: string, extra: Record<string, unknown> = {}) => ({
      sql: `insert into shop_edition_stock_batch
              (artwork_id, first_stock_ref, quantity, artist_count, lax_count, custody_status, added_by_subject_id)
            values ($1, $2, $3, $4, $5, $6, 'staff-1')`,
      params: [
        artwork,
        extra.first ?? 1,
        extra.quantity ?? 20,
        extra.artist ?? 10,
        extra.lax ?? 10,
        extra.custody ?? "unprinted",
      ],
    });

    it("accepts a batch whose owners add up to its quantity", async () => {
      const artwork = await insertArtwork({});
      const probe = batch(artwork);
      expect(await accepts(probe.sql, probe.params)).toBe(true);
    });

    it.each([
      ["owners that do not add up", { artist: 9 }],
      ["an empty batch", { quantity: 0, artist: 0, lax: 0 }],
      ["a negative owner count", { artist: 21, lax: -1 }],
      ["a custody a new print cannot start in", { custody: "delivered" }],
    ])("refuses %s", async (_name, extra) => {
      const artwork = await insertArtwork({});
      const probe = batch(artwork, extra);
      expect(await accepts(probe.sql, probe.params)).toBe(false);
    });
  });

  describe("fulfilment records", () => {
    async function columnsOf(table: string, names: string[]): Promise<string[]> {
      const { rows } = await client.query(
        "select column_name from information_schema.columns where table_name = $1 and column_name = any($2)",
        [table, names],
      );
      return rows.map((row) => row.column_name as string).sort();
    }

    it("adds the order line snapshot, pack confirmation and swap columns", async () => {
      expect(
        await columnsOf("shop_order_line", [
          "edition_facts_snapshot",
          "print_label",
          "pack_confirmed_at",
          "pack_confirmed_by",
          "swapped_from_edition_id",
        ]),
      ).toHaveLength(5);
    });

    it("adds the certificate reference, issuer and form with a vocabulary check", async () => {
      expect(
        await columnsOf("shop_certificate", ["certificate_reference", "issuer", "form"]),
      ).toHaveLength(3);
      const { rows } = await client.query(
        "select 1 from pg_constraint where conname = 'shop_certificate_vocabulary_ck'",
      );
      expect(rows).toHaveLength(1);
    });

    it("leaves has_certificate, the picked status and the request limit for later steps", async () => {
      expect(await columnsOf("shop_artwork", ["has_certificate"])).toEqual(["has_certificate"]);
      const picked = await client.query(
        "select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'shop_fulfilment_status' and e.enumlabel = 'picked'",
      );
      expect(picked.rows).toHaveLength(0);
    });
  });

  describe("rollback", () => {
    it("restores the previous shape and the forward migration applies again", async () => {
      await client.query(read("0246_rollback.sql"));
      const gone = await client.query(
        `select table_name from information_schema.tables where table_name in ('shop_edition_facts', 'shop_edition_stock_batch')`,
      );
      expect(gone.rows).toHaveLength(0);
      const nullable = await client.query(
        "select is_nullable from information_schema.columns where table_name = 'shop_edition' and column_name = 'edition_number'",
      );
      expect(nullable.rows[0].is_nullable).toBe("NO");
      await client.query(read("0246_shop_edition_runs.sql"));
      const back = await client.query(
        "select column_name from information_schema.columns where table_name = 'shop_edition' and column_name = 'stock_ref'",
      );
      expect(back.rows).toHaveLength(1);
    });
  });
});
