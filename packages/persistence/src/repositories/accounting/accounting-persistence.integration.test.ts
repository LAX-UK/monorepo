import { randomUUID } from "node:crypto";
import {
  type AccountingDocument,
  type Product,
  type Result,
  SETTLE_GRACE_MS,
  buildContact,
  buildCreditNoteFor,
  buildInvoice,
  buildPayment,
  laxReference,
  parseLaxReference,
} from "@auction/accounting-domain";
import { closeDb, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AccountingProvider } from "../../interfaces/accounting.js";
import { createAccountingRepositories } from "./create-accounting-repositories.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);

const T0 = Date.parse("2031-03-01T10:00:00Z");
let nowMs = T0;
const clock = { now: () => new Date(nowMs) };
const LEASE_MS = 60_000;
const ALL_MODES = ["dry_run", "test_org", "live"] as const;
const PROVIDER: AccountingProvider = "books";

function must<T, C extends string>(result: Result<T, C>): T {
  if (!result.ok) throw new Error(`${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

const newId = () => randomUUID().replaceAll("-", "").slice(0, 16);

function invoice(product: Product, sourceId: string, unitNetPence = 10_000): AccountingDocument {
  return must(
    buildInvoice({
      product,
      sourceId,
      contactReference: must(laxReference(product, "contact", sourceId)),
      issuedOn: "2031-03-01",
      dueOn: "2031-03-15",
      lines: [
        {
          description: "Lot 1",
          quantity: 1,
          unitNetPence,
          treatment: "standard",
          role: "goods",
        },
      ],
    }),
  );
}

/** A Bid payment applied to the given invoices, each by its whole total. */
function paymentFor(
  invoices: readonly AccountingDocument[],
  sourceId = newId(),
): AccountingDocument {
  const allocations = invoices.map((i) => ({
    invoiceReference: i.reference,
    amountPence: i.kind === "invoice" ? i.totals.grossPence : 0,
  }));
  return must(
    buildPayment({
      product: "bid",
      sourceId,
      contactReference: must(laxReference("bid", "contact", sourceId)),
      receivedOn: "2031-03-02",
      amountPence: allocations.reduce((sum, a) => sum + a.amountPence, 0),
      allocations,
    }),
  );
}

function codeOf(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

async function rejectedCode(work: Promise<unknown>): Promise<string | undefined> {
  try {
    await work;
  } catch (error) {
    return codeOf(error);
  }
  return undefined;
}

describe.skipIf(!HAS_DB)("accounting persistence (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  // The repositories run as the worker role when it is configured, so the grants are exercised too.
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  const repos = createAccountingRepositories(worker, clock);

  /** Test hygiene as the owner: nothing left pending or sending from an earlier test. */
  async function drain() {
    await owner.execute(sql`
      update accounting_document
         set state = 'cancelled', lease_token = null, lease_expires_at = null, settles_at = null
       where state in ('pending', 'sending')`);
  }

  async function eventsOf(documentId: string) {
    const rows = await owner.execute<{
      action: string;
      from_state: string | null;
      to_state: string;
    }>(
      sql`select action, from_state, to_state from accounting_document_event
          where document_id = ${documentId} order by id`,
    );
    return rows.rows.map((r) => `${r.action}:${r.from_state ?? "-"}>${r.to_state}`);
  }

  async function register(document: AccountingDocument) {
    await contactInBooks(document);
    return must(await repos.registry.register({ document, sourceEventRef: `evt-${newId()}` }));
  }

  /**
   * An invoice or credit note waits for its contact (`documentsAwaited`). These cases are about
   * the invoice itself, so its contact is put in the books for the target the switch names now,
   * as the owner, before it is registered. Cases about the ordering itself register their own.
   */
  async function contactInBooks(document: AccountingDocument) {
    if (document.kind !== "invoice" && document.kind !== "credit_note") return;
    const contactRef = must(parseLaxReference(document.contactReference));
    const contact = must(
      buildContact({
        product: document.product,
        sourceId: contactRef.sourceId,
        name: "Fixture contact",
        email: null,
      }),
    );
    const { stored } = must(
      await repos.registry.register({ document: contact, sourceEventRef: `evt-${newId()}` }),
    );
    // With no target nothing is claimed, so there is nothing to wait for.
    if (stored.record.status === "issued" || stored.target === null) return;
    await owner.execute(sql`
      update accounting_document
         set state = 'issued', provider = coalesce(target_provider, 'books'), attempts = 1,
             provider_id = ${`con-${newId()}`}, provider_number = 'CON-1',
             created_at = created_at - interval '1 day', updated_at = updated_at - interval '1 day'
       where id = ${stored.id}`);
  }

  type Mode = "off" | "dry_run" | "test_org" | "live";
  /** One mode pair for every product. The default is Books in dry run, Xero off. */
  async function setModes(books: Mode, xero: Mode = "off") {
    await owner.execute(sql`
      insert into accounting_source_setting (product, xero_mode, books_mode) values
        ('bid', ${xero}, ${books}), ('shop', ${xero}, ${books}), ('lax_art', ${xero}, ${books})
      on conflict (product) do update
        set xero_mode = excluded.xero_mode, books_mode = excluded.books_mode`);
  }
  /** The migration's seed: Bid's invoices go to Xero, the rest has no provider, Books is off. */
  async function restoreSeed() {
    await owner.execute(sql`
      update accounting_source_setting
         set xero_mode = case product when 'bid' then 'live' else 'off' end, books_mode = 'off'`);
  }

  beforeAll(async () => {
    await drain();
  });
  beforeEach(async () => {
    nowMs = T0;
    await setModes("dry_run");
    await drain();
  });
  afterAll(async () => {
    await drain();
    await restoreSeed();
    await closeDb(owner);
    await closeDb(worker);
  });

  describe("references", () => {
    it("holds one document per product, entity, reference and target", async () => {
      const id = newId();
      const first = await register(invoice("bid", id));
      expect(first.created).toBe(true);
      expect(await eventsOf(first.stored.id)).toEqual(["created:->pending"]);

      const replay = await register(invoice("bid", id));
      expect(replay.created).toBe(false);
      expect(replay.stored.id).toBe(first.stored.id);

      const different = await repos.registry.register({
        document: invoice("bid", id, 20_000),
        sourceEventRef: "evt-other",
      });
      expect(different.ok).toBe(false);
      if (!different.ok) expect(different.refusal.code).toBe("reference_in_use");

      // The database refuses a duplicate for the same target even when the repository is bypassed.
      const duplicate = await rejectedCode(
        owner.execute(sql`
          insert into accounting_document
            (product, legal_entity, kind, lax_reference, source_event_ref, payload, net_pence, vat_pence, gross_pence,
             target_provider, target_mode)
          values ('bid', 'london_auction_xchange', 'invoice', ${first.stored.reference}, 'x', '{}'::jsonb, 1, 0, 1,
                  'books', 'dry_run')`),
      );
      expect(duplicate).toBe("23505");
    });

    it("keeps one document with no target per reference", async () => {
      await setModes("off");
      const id = newId();
      const first = await register(invoice("bid", id));
      expect(first.stored.target).toBeNull();
      const replay = await register(invoice("bid", id));
      expect(replay.created).toBe(false);
      expect(replay.stored.id).toBe(first.stored.id);
      const duplicate = await rejectedCode(
        owner.execute(sql`
          insert into accounting_document
            (product, legal_entity, kind, lax_reference, source_event_ref, payload, net_pence, vat_pence, gross_pence)
          values ('bid', 'london_auction_xchange', 'invoice', ${first.stored.reference}, 'x', '{}'::jsonb, 1, 0, 1)`),
      );
      expect(duplicate).toBe("23505");
    });

    it("a reference rehearsed in dry_run is queued again, pending, for test_org and the test_org sender claims it", async () => {
      const id = newId();
      const rehearsed = await register(invoice("bid", id));
      expect(rehearsed.stored.target).toEqual({ provider: "books", mode: "dry_run" });
      // The rehearsal sends it, as the dry run adapter answers: issued, final.
      must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "rehearsal",
          leaseMs: LEASE_MS,
          targetModes: ["dry_run"],
        }),
      );
      must(
        await repos.transitions.apply(rehearsed.stored.id, {
          action: "complete_sending",
          leaseToken: "rehearsal",
          outcome: {
            status: "issued",
            number: "DRY-RUN",
            providerId: `dry-run:${rehearsed.stored.reference}`,
            pdfRef: null,
            totals: rehearsed.stored.totals,
          },
        }),
      );

      // Later, the switch moves Bid to the test organisation; the same document is projected again.
      nowMs = T0 + 60 * 60_000;
      await setModes("test_org");
      const again = await register(invoice("bid", id));
      expect(again.created).toBe(true);
      expect(again.stored.id).not.toBe(rehearsed.stored.id);
      expect(again.stored.target).toEqual({ provider: "books", mode: "test_org" });
      expect(again.stored.record.status).toBe("pending");
      // A replay for the test organisation finds its own row, not the rehearsal's.
      const replay = await register(invoice("bid", id));
      expect(replay).toMatchObject({ created: false, stored: { id: again.stored.id } });

      const claimed = must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "test-org",
          leaseMs: LEASE_MS,
          targetModes: ["test_org"],
        }),
      );
      expect(claimed?.id).toBe(again.stored.id);
      expect(claimed?.record.status).toBe("sending");

      // Each target's row is read on its own; the rehearsal row is untouched.
      const dryRow = must(
        await repos.lookup.findByReference("bid", rehearsed.stored.reference, {
          provider: "books",
          mode: "dry_run",
        }),
      );
      expect(dryRow?.id).toBe(rehearsed.stored.id);
      expect(dryRow?.record.status).toBe("issued");
      const latest = must(await repos.lookup.findByReference("bid", rehearsed.stored.reference));
      expect(latest?.id).toBe(again.stored.id);
      expect(await eventsOf(rehearsed.stored.id)).toEqual([
        "created:->pending",
        "start_sending:pending>sending",
        "complete_sending:sending>issued",
      ]);
    });

    it("keeps the same source id in two products apart and looks each up by product", async () => {
      const id = newId();
      const bid = await register(invoice("bid", id));
      const shop = await register(invoice("shop", id));
      expect(bid.stored.id).not.toBe(shop.stored.id);
      expect(bid.stored.reference).toBe(`LAX-BID-INV-${id}`);
      expect(shop.stored.legalEntity).toBe("london_art_exchange");

      const found = must(await repos.lookup.findByReference("shop", `LAX-SHOP-INV-${id}`));
      expect(found?.id).toBe(shop.stored.id);
      expect(must(await repos.lookup.findByReference("shop", `LAX-BID-INV-${id}`))).toBeNull();
      expect(must(await repos.lookup.findByReference("lax_art", `LAX-ART-INV-${id}`))).toBeNull();
    });

    it("refuses a document whose totals or references the domain would not produce", async () => {
      const id = newId();
      const good = invoice("bid", id);
      const tampered = {
        ...good,
        totals: { ...(good as { totals: object }).totals, grossPence: 1 },
      };
      const refused = await repos.registry.register({
        document: tampered as unknown as AccountingDocument,
        sourceEventRef: "evt",
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.refusal.code).toBe("bad_document");
      const wrongEntity = await repos.registry.register({
        document: { ...good, entity: "london_art_exchange" } as AccountingDocument,
        sourceEventRef: "evt",
      });
      expect(wrongEntity.ok).toBe(false);
      expect(must(await repos.lookup.findByReference("bid", `LAX-BID-INV-${id}`))).toBeNull();
    });

    it("refuses to read back a stored payload that no longer matches its columns", async () => {
      const stored = (await register(invoice("bid", newId()))).stored;
      await owner.execute(sql`
        update accounting_document
           set payload = jsonb_set(payload, '{totals,grossPence}', '1'::jsonb)
         where id = ${stored.id}`);
      const read = await repos.lookup.findByReference("bid", stored.reference);
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.refusal.code).toBe("bad_stored_document");
    });
  });

  describe("a document is claimed only by the provider and mode it was created for (D4b)", () => {
    const claim = (provider: AccountingProvider) =>
      repos.workQueue.claimNext({
        provider,
        leaseToken: randomUUID(),
        leaseMs: LEASE_MS,
        targetModes: ALL_MODES,
      });
    const targetOf = async (id: string) =>
      (
        await owner.execute<{ target_provider: string | null; target_mode: string | null }>(
          sql`select target_provider, target_mode from accounting_document where id = ${id}`,
        )
      ).rows[0];

    it("records the target from the switch when the document is created", async () => {
      await setModes("test_org", "live");
      const live = await register(invoice("bid", newId()));
      expect(live.stored.target).toEqual({ provider: "xero", mode: "live" });
      expect(await targetOf(live.stored.id)).toEqual({
        target_provider: "xero",
        target_mode: "live",
      });
      await setModes("test_org");
      const rehearsal = await register(invoice("bid", newId()));
      expect(rehearsal.stored.target).toEqual({ provider: "books", mode: "test_org" });
      await setModes("off");
      const none = await register(invoice("bid", newId()));
      expect(none.stored.target).toBeNull();
      expect(await targetOf(none.stored.id)).toEqual({ target_provider: null, target_mode: null });
    });

    it("probe: Xero live and Books test_org or dry_run, so a Books claim takes nothing live", async () => {
      for (const books of ["test_org", "dry_run"] as const) {
        await drain();
        await setModes(books, "live");
        const doc = await register(invoice("bid", newId()));
        expect(must(await claim("books")), books).toBeNull();
        const row = await owner.execute<{ state: string; provider: string | null }>(
          sql`select state, provider from accounting_document where id = ${doc.stored.id}`,
        );
        expect(row.rows[0], books).toEqual({ state: "pending", provider: null });
        const owned = must(await claim("xero"));
        expect(owned?.id, books).toBe(doc.stored.id);
        expect(owned?.provider).toBe("xero");
      }
    });

    it("hands a rehearsal document only to its provider in that same mode", async () => {
      for (const mode of ["dry_run", "test_org"] as const) {
        await drain();
        await setModes(mode);
        const doc = await register(invoice("shop", newId()));
        expect(must(await claim("xero")), mode).toBeNull();
        expect(must(await claim("books"))?.id, mode).toBe(doc.stored.id);
      }
    });

    it("hands a live document only to the live provider", async () => {
      await setModes("off", "live");
      const doc = await register(invoice("bid", newId()));
      expect(must(await claim("books"))).toBeNull();
      expect(must(await claim("xero"))?.id).toBe(doc.stored.id);
    });

    it("never re-aims a document when the switch is flipped", async () => {
      await setModes("off", "live");
      const toXero = await register(invoice("bid", newId()));
      await setModes("live", "off");
      expect(must(await claim("books"))).toBeNull();
      expect(must(await claim("xero"))).toBeNull();
      expect((await targetOf(toXero.stored.id))?.target_provider).toBe("xero");
      // A document made after the flip is aimed at the new live source only.
      const toBooks = await register(invoice("bid", newId()));
      expect(must(await claim("xero"))).toBeNull();
      expect(must(await claim("books"))?.id).toBe(toBooks.stored.id);
      // Flipping back makes the Xero document claimable again, and by Xero alone.
      await setModes("off", "live");
      expect(must(await claim("books"))).toBeNull();
      expect(must(await claim("xero"))?.id).toBe(toXero.stored.id);
    });

    it("does not take a rehearsal document once its mode has moved on", async () => {
      await setModes("dry_run");
      await register(invoice("shop", newId()));
      for (const books of ["test_org", "live", "off"] as const) {
        await setModes(books);
        expect(must(await claim("books")), books).toBeNull();
      }
    });

    it("hands nothing to a provider whose mode for the product is off", async () => {
      await setModes("dry_run");
      await register(invoice("shop", newId()));
      await owner.execute(sql`
        update accounting_source_setting set books_mode = 'off' where product = 'shop'`);
      expect(must(await claim("books"))).toBeNull();
    });

    it("hands nothing for a document that has no target", async () => {
      await setModes("off");
      const doc = await register(invoice("shop", newId()));
      expect(doc.stored.target).toBeNull();
      await setModes("dry_run");
      expect(must(await claim("books"))).toBeNull();
      expect(must(await claim("xero"))).toBeNull();
    });

    it("refuses a target the database cannot hold", async () => {
      const doc = await register(invoice("shop", newId()));
      for (const set of [
        sql`target_provider = 'zoho'`,
        sql`target_mode = 'off'`,
        sql`target_provider = null`,
        sql`target_provider = 'xero', target_mode = null`,
      ]) {
        const code = await rejectedCode(
          owner.execute(sql`update accounting_document set ${set} where id = ${doc.stored.id}`),
        );
        expect(code).toBe("23514");
      }
      expect(
        await rejectedCode(
          owner.execute(sql`
          update accounting_document set provider = 'xero', state = 'sending',
            lease_token = 't', lease_expires_at = now(), attempts = 1
           where id = ${doc.stored.id}`),
        ),
      ).toBe("23514");
    });

    it("still settles a lapsed lease when the switch is off, and calls no provider", async () => {
      const doc = await register(invoice("shop", newId()));
      expect(must(await claim("books"))?.id).toBe(doc.stored.id);
      await setModes("off");
      nowMs = T0 + LEASE_MS + 1;
      expect(must(await claim("books"))).toBeNull();
      const row = await owner.execute<{ state: string }>(
        sql`select state from accounting_document where id = ${doc.stored.id}`,
      );
      expect(row.rows[0]?.state).toBe("unknown");
    });
  });

  describe("credit notes round-trip through storage (D3)", () => {
    it("registers and reads back partial credit notes of 3p and 501p, which are tax-inclusive", async () => {
      const inv = invoice("shop", newId(), 1000);
      if (inv.kind !== "invoice") throw new Error("fixture");
      await register(inv);
      const buckets = {
        paidGoodsPence: 1200,
        paidDeliveryPence: 0,
        refundedGoodsPence: 0,
        refundedDeliveryPence: 0,
      };
      const prior: AccountingDocument[] = [];
      let refunded = 0;
      for (const gross of [3, 501, 696]) {
        const credit = must(
          buildCreditNoteFor(inv, {
            sourceId: newId(),
            issuedOn: "2031-03-02",
            buckets: { ...buckets, refundedGoodsPence: refunded },
            request: { goodsPence: gross, deliveryPence: 0 },
            priorCredits: prior as never,
          }),
        );
        const registered = await register(credit);
        expect(registered.stored.document).toEqual(credit);
        const read = must(await repos.lookup.findByReference("shop", credit.reference));
        expect(read?.document).toEqual(credit);
        prior.push(credit);
        refunded += gross;
      }
      expect(
        prior.reduce((n, c) => n + (c as { totals: { vatPence: number } }).totals.vatPence, 0),
      ).toBe(200);
    });

    it("refuses a credit note whose lines are not tax-inclusive, or whose VAT exceeds its gross", async () => {
      const inv = invoice("shop", newId(), 1000);
      if (inv.kind !== "invoice") throw new Error("fixture");
      const credit = must(
        buildCreditNoteFor(inv, {
          sourceId: newId(),
          issuedOn: "2031-03-02",
          buckets: {
            paidGoodsPence: 1200,
            paidDeliveryPence: 0,
            refundedGoodsPence: 0,
            refundedDeliveryPence: 0,
          },
          request: { goodsPence: 600, deliveryPence: 0 },
          priorCredits: [],
        }),
      );
      const flip = (patch: object) =>
        repos.registry.register({
          document: { ...credit, ...patch } as unknown as AccountingDocument,
          sourceEventRef: "evt",
        });
      expect((await flip({ amountsAre: "tax_exclusive" })).ok).toBe(false);
      const line = credit.kind === "credit_note" ? credit.lines[0] : undefined;
      expect((await flip({ lines: [{ ...line, basis: "tax_exclusive" }] })).ok).toBe(false);
      expect((await flip({ lines: [{ ...line, vatPence: 10_000, unitNetPence: 0 }] })).ok).toBe(
        false,
      );
    });

    it("reads a row whose lease a slightly faster worker clock granted", async () => {
      const doc = await register(invoice("shop", newId()));
      must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "t",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      // A reader 30 s behind the granting clock still loads the row (the skew margin).
      const behind = createAccountingRepositories(worker, { now: () => new Date(nowMs - 30_000) });
      expect(
        must(await behind.lookup.findByReference("shop", doc.stored.reference))?.record.status,
      ).toBe("sending");
    });
  });

  describe("least privilege (L1, L2)", () => {
    it.skipIf(!WORKER_URL)("L1: the worker cannot rewrite what a document says", async () => {
      const doc = await register(invoice("shop", newId()));
      for (const set of [
        sql`payload = '{}'::jsonb`,
        sql`gross_pence = 1`,
        sql`product = 'bid'`,
        sql`target_provider = 'xero', target_mode = 'live'`,
        sql`lax_reference = 'LAX-SHOP-INV-other'`,
      ]) {
        expect(
          await rejectedCode(
            worker.execute(sql`update accounting_document set ${set} where id = ${doc.stored.id}`),
          ),
        ).toBe("42501");
      }
      // What it writes still works.
      await worker.execute(
        sql`update accounting_document set last_error_class = 'x', updated_at = now() where id = ${doc.stored.id}`,
      );
    });

    it.skipIf(!API_URL)("L2: the Bid API reads the switch but cannot update it", async () => {
      const api = createDb(API_URL as string);
      try {
        const read = await api.execute(sql`select product from accounting_source_setting`);
        expect(read.rows.length).toBe(3);
        expect(
          await rejectedCode(
            api.execute(sql`update accounting_source_setting set books_mode = 'live'`),
          ),
        ).toBe("42501");
      } finally {
        await closeDb(api);
      }
    });
  });

  describe("claiming", () => {
    it("never hands one document to two concurrent claimers", async () => {
      const registered = await Promise.all(
        Array.from({ length: 5 }, () => register(invoice("bid", newId()))),
      );
      const ids = new Set(registered.map((r) => r.stored.id));

      const claims = await Promise.all(
        Array.from({ length: 12 }, () =>
          repos.workQueue.claimNext({
            provider: PROVIDER,
            leaseToken: randomUUID(),
            leaseMs: LEASE_MS,
            targetModes: ALL_MODES,
          }),
        ),
      );
      const claimed = claims.map(must).filter((c) => c !== null);
      expect(claimed).toHaveLength(5);
      expect(new Set(claimed.map((c) => c.id))).toEqual(ids);
      for (const c of claimed) {
        expect(c.record.status).toBe("sending");
        expect(c.record.attempts).toBe(1);
        expect(c.provider).toBe(PROVIDER);
        expect(await eventsOf(c.id)).toEqual([
          "created:->pending",
          "start_sending:pending>sending",
        ]);
      }
    });

    it("claims the oldest first and leaves nothing when the queue is empty", async () => {
      nowMs = T0;
      const older = await register(invoice("bid", newId()));
      nowMs = T0 + 1_000;
      await register(invoice("bid", newId()));
      const first = must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "a",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      expect(first?.id).toBe(older.stored.id);
      must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "b",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      expect(
        must(
          await repos.workQueue.claimNext({
            provider: PROVIDER,
            leaseToken: "c",
            leaseMs: LEASE_MS,
            targetModes: ALL_MODES,
          }),
        ),
      ).toBeNull();
    });

    it("turns an expired lease into unknown instead of handing the document out again", async () => {
      const { stored } = await register(invoice("bid", newId()));
      const claimed = must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "gone",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      expect(claimed?.id).toBe(stored.id);

      // The lease is still good: nothing to hand out, and the document is left alone.
      nowMs = T0 + LEASE_MS - 1;
      expect(
        must(
          await repos.workQueue.claimNext({
            provider: PROVIDER,
            leaseToken: "x",
            leaseMs: LEASE_MS,
            targetModes: ALL_MODES,
          }),
        ),
      ).toBeNull();
      expect(must(await repos.lookup.findByReference("bid", stored.reference))?.record.status).toBe(
        "sending",
      );

      // The sender never came back.
      nowMs = T0 + LEASE_MS;
      const next = await register(invoice("bid", newId()));
      const reclaimed = must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "y",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      // The lapsed one is settled to unknown on the way; the caller gets the next pending one.
      expect(reclaimed?.id).toBe(next.stored.id);
      const lapsed = must(await repos.lookup.findByReference("bid", stored.reference));
      expect(lapsed?.record).toMatchObject({
        status: "unknown",
        attempts: 1,
        settlesAtMs: T0 + LEASE_MS + SETTLE_GRACE_MS,
      });
      expect(await eventsOf(stored.id)).toEqual([
        "created:->pending",
        "start_sending:pending>sending",
        "expire_lease:sending>unknown",
      ]);

      // A lookup that finds nothing is trusted only after the first request has settled.
      const early = await repos.transitions.apply(stored.id, {
        action: "apply_lookup",
        outcome: { status: "not_found" },
      });
      expect(early.ok).toBe(false);
      if (!early.ok) expect(early.refusal.code).toBe("lookup_too_early");
      nowMs = T0 + LEASE_MS + SETTLE_GRACE_MS;
      const settled = must(
        await repos.transitions.apply(stored.id, {
          action: "apply_lookup",
          outcome: { status: "not_found" },
        }),
      );
      expect(settled.record.status).toBe("pending");
    });

    it("does not trust a late answer from a sender whose lease lapsed", async () => {
      const { stored } = await register(invoice("bid", newId()));
      must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "slow",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      nowMs = T0 + LEASE_MS + 5;
      const late = must(
        await repos.transitions.apply(stored.id, {
          action: "complete_sending",
          leaseToken: "slow",
          outcome: {
            status: "issued",
            number: "INV-1",
            providerId: "p1",
            pdfRef: null,
            totals: stored.totals,
          },
        }),
      );
      expect(late.record.status).toBe("unknown");
    });
  });

  describe("a payment waits for its invoices (dependency ordering)", () => {
    const claim = async (leaseToken: string) =>
      must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken,
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
    const issue = async (id: string, leaseToken: string) => {
      const stored = must(await repos.lookup.findByReference("bid", (await byId(id)).reference));
      must(
        await repos.transitions.apply(id, {
          action: "complete_sending",
          leaseToken,
          outcome: {
            status: "issued",
            number: `INV-${newId()}`,
            providerId: newId(),
            pdfRef: null,
            totals: (stored as NonNullable<typeof stored>).totals,
          },
        }),
      );
    };
    const byId = async (id: string) => {
      const rows = await owner.execute<{ lax_reference: string; state: string; attempts: number }>(
        sql`select lax_reference, state, attempts from accounting_document where id = ${id}`,
      );
      const row = rows.rows[0];
      if (!row) throw new Error(`no document ${id}`);
      return { reference: row.lax_reference, state: row.state, attempts: row.attempts };
    };

    it("is not claimed before its invoice is issued, even when it is older; then it is", async () => {
      const inv = invoice("bid", newId());
      nowMs = T0;
      const payment = await register(paymentFor([inv]));
      nowMs = T0 + 1_000;
      const invoiceRow = await register(inv);
      const first = await claim("inv");
      expect(first?.id).toBe(invoiceRow.stored.id);
      expect(await claim("early")).toBeNull();
      expect(await byId(payment.stored.id)).toMatchObject({ state: "pending", attempts: 0 });
      await issue(invoiceRow.stored.id, "inv");
      expect((await claim("pay"))?.id).toBe(payment.stored.id);
    });

    it("an invoice is not claimed before its contact is issued, even at the same instant and older", async () => {
      const sourceId = newId();
      const inv = invoice("bid", sourceId);
      const contact = must(
        buildContact({ product: "bid", sourceId, name: "Ada Collector", email: null }),
      );
      nowMs = T0;
      // Stored in the wrong order, in one instant: the claim alone must put the contact first.
      const invoiceRow = must(
        await repos.registry.register({ document: inv, sourceEventRef: `evt-${newId()}` }),
      );
      const contactRow = must(
        await repos.registry.register({ document: contact, sourceEventRef: `evt-${newId()}` }),
      );
      const first = await claim("con");
      expect(first?.id).toBe(contactRow.stored.id);
      expect(await claim("early")).toBeNull();
      expect(await byId(invoiceRow.stored.id)).toMatchObject({ state: "pending", attempts: 0 });
      must(
        await repos.transitions.apply(contactRow.stored.id, {
          action: "complete_sending",
          leaseToken: "con",
          outcome: {
            status: "issued",
            number: `CON-${newId()}`,
            providerId: newId(),
            pdfRef: null,
            totals: contactRow.stored.totals,
          },
        }),
      );
      expect((await claim("inv"))?.id).toBe(invoiceRow.stored.id);
    });

    it("waits while its invoice failed, without holding up the documents behind it", async () => {
      const inv = invoice("bid", newId());
      const invoiceRow = await register(inv);
      nowMs = T0 + 1_000;
      const payment = await register(paymentFor([inv]));
      nowMs = T0 + 2_000;
      const later = await register(invoice("bid", newId()));
      expect((await claim("inv"))?.id).toBe(invoiceRow.stored.id);
      must(
        await repos.transitions.apply(invoiceRow.stored.id, {
          action: "complete_sending",
          leaseToken: "inv",
          outcome: { status: "rejected", reason: "zoho_books_validation_invalid_request" },
        }),
      );
      expect((await claim("next"))?.id).toBe(later.stored.id);
      expect(await claim("none")).toBeNull();
      expect(await byId(payment.stored.id)).toMatchObject({ state: "pending", attempts: 0 });
    });

    it("waits for every invoice of a Pay several payment, and for an invoice not registered yet", async () => {
      const a = invoice("bid", newId());
      const b = invoice("bid", newId(), 2_501);
      const aRow = await register(a);
      nowMs = T0 + 1_000;
      const payment = await register(paymentFor([a, b]));
      expect((await claim("a"))?.id).toBe(aRow.stored.id);
      await issue(aRow.stored.id, "a");
      // b is not in the queue at all yet: the payment still waits.
      expect(await claim("early")).toBeNull();
      nowMs = T0 + 2_000;
      const bRow = await register(b);
      expect((await claim("b"))?.id).toBe(bRow.stored.id);
      expect(await claim("still")).toBeNull();
      await issue(bRow.stored.id, "b");
      expect((await claim("pay"))?.id).toBe(payment.stored.id);
    });

    it("does not count an invoice issued for another target (a rehearsal) as in the books", async () => {
      const inv = invoice("bid", newId());
      const rehearsed = await register(inv);
      expect((await claim("dry"))?.id).toBe(rehearsed.stored.id);
      await issue(rehearsed.stored.id, "dry");
      await setModes("test_org");
      const payment = await register(paymentFor([inv]));
      // The invoice has not reached the test organisation: the payment waits for it there.
      expect(await claim("test")).toBeNull();
      expect(await byId(payment.stored.id)).toMatchObject({ state: "pending" });
    });
  });

  describe("parked documents", () => {
    it("are stored straight into Needs a person, never claimed, and a replay leaves them parked", async () => {
      const inv = invoice("bid", newId());
      const parked = must(
        await repos.registry.register({
          document: inv,
          sourceEventRef: `evt-${newId()}`,
          park: "vat_on_delivery",
        }),
      );
      expect(parked.created).toBe(true);
      expect(parked.stored.record).toMatchObject({
        status: "needs_review",
        lookup: "clear",
        issued: null,
        reason: "accounting_parked_vat_on_delivery",
      });
      expect(await eventsOf(parked.stored.id)).toEqual(["created:->needs_review"]);
      expect(
        must(
          await repos.workQueue.claimNext({
            provider: PROVIDER,
            leaseToken: "never",
            leaseMs: LEASE_MS,
            targetModes: ALL_MODES,
          }),
        ),
      ).toBeNull();
      const replay = must(
        await repos.registry.register({ document: inv, sourceEventRef: "evt-2" }),
      );
      expect(replay.created).toBe(false);
      expect(replay.stored.record.status).toBe("needs_review");
      expect(await repos.transitions.apply(parked.stored.id, { action: "requeue" })).toMatchObject({
        ok: false,
        refusal: { code: "parked" },
      });
      expect(await eventsOf(parked.stored.id)).toEqual(["created:->needs_review"]);
      expect(
        must(await repos.transitions.apply(parked.stored.id, { action: "cancel" })).record.status,
      ).toBe("cancelled");
    });
  });

  describe("transitions", () => {
    async function sending(unitNetPence = 10_000) {
      const { stored } = await register(invoice("bid", newId(), unitNetPence));
      const claimed = must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "tok",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      expect(claimed?.id).toBe(stored.id);
      return stored;
    }

    it("persists an accepted answer with the provider's document and one history row", async () => {
      const stored = await sending();
      const done = must(
        await repos.transitions.apply(stored.id, {
          action: "complete_sending",
          leaseToken: "tok",
          outcome: {
            status: "issued",
            number: "INV-0042",
            providerId: "books-42",
            pdfRef: "pdf/42",
            totals: stored.totals,
          },
        }),
      );
      expect(done.record).toMatchObject({
        status: "issued",
        issued: { number: "INV-0042", providerId: "books-42", pdfRef: "pdf/42" },
      });
      expect(await eventsOf(stored.id)).toEqual([
        "created:->pending",
        "start_sending:pending>sending",
        "complete_sending:sending>issued",
      ]);
      const again = must(await repos.lookup.findByReference("bid", stored.reference));
      expect(again?.record).toEqual(done.record);
    });

    it("keeps the provider's document and the mismatch when its totals differ from ours", async () => {
      const stored = await sending();
      const done = must(
        await repos.transitions.apply(stored.id, {
          action: "complete_sending",
          leaseToken: "tok",
          outcome: {
            status: "issued",
            number: "INV-7",
            providerId: "books-7",
            pdfRef: null,
            totals: { ...stored.totals, grossPence: stored.totals.grossPence + 1 },
          },
        }),
      );
      expect(done.record).toMatchObject({
        status: "needs_review",
        lookup: "clear",
        issued: { providerId: "books-7" },
        mismatch: { field: "grossPence", differencePence: 1 },
      });
      // It holds the provider's document, so a person must resolve it: no requeue, no cancel.
      for (const action of ["requeue", "cancel"] as const) {
        const refused = await repos.transitions.apply(stored.id, { action });
        expect(refused.ok).toBe(false);
      }
    });

    it("holds a document that differs on read-back for a person, with both totals on record", async () => {
      const stored = await sending();
      const theirs = { ...stored.totals, grossPence: stored.totals.grossPence + 1 };
      const done = must(
        await repos.transitions.apply(stored.id, {
          action: "complete_sending",
          leaseToken: "tok",
          outcome: {
            status: "differs",
            reason: "zoho_books_payment_mismatch",
            number: "PMT-9",
            providerId: "books-9",
            pdfRef: null,
            totals: theirs,
          },
        }),
      );
      expect(done.record).toMatchObject({
        status: "needs_review",
        lookup: "clear",
        issued: { providerId: "books-9", number: "PMT-9" },
        mismatch: { field: "grossPence", differencePence: 1 },
      });
      const [last] = (
        await owner.execute<{ detail: Record<string, unknown> }>(
          sql`select detail from accounting_document_event
              where document_id = ${stored.id} order by id desc limit 1`,
        )
      ).rows;
      expect(last?.detail).toEqual({
        outcome: "differs",
        reason: "zoho_books_payment_mismatch",
        providerTotals: theirs,
        expectedTotals: stored.totals,
      });
      for (const action of ["requeue", "cancel"] as const) {
        expect((await repos.transitions.apply(stored.id, { action })).ok).toBe(false);
      }
    });

    it("records a failure's class and keeps it through a requeue", async () => {
      const stored = await sending();
      const failed = must(
        await repos.transitions.apply(stored.id, {
          action: "complete_sending",
          leaseToken: "tok",
          outcome: { status: "rejected", reason: "validation_error" },
        }),
      );
      expect(failed.record).toMatchObject({ status: "failed", reason: "validation_error" });
      const pending = must(await repos.transitions.apply(stored.id, { action: "requeue" }));
      expect(pending.record.status).toBe("pending");
      expect(pending.lastErrorClass).toBe("validation_error");
    });

    it("refuses an illegal transition and writes neither a state nor a history row", async () => {
      const { stored } = await register(invoice("bid", newId()));
      const before = await eventsOf(stored.id);

      const notSending = await repos.transitions.apply(stored.id, {
        action: "complete_sending",
        leaseToken: "tok",
        outcome: { status: "unknown" },
      });
      expect(notSending.ok).toBe(false);
      if (!notSending.ok) expect(notSending.refusal.code).toBe("bad_state");

      const noLookupOwed = await repos.transitions.apply(stored.id, {
        action: "apply_lookup",
        outcome: {
          status: "found",
          number: "n",
          providerId: "p",
          pdfRef: null,
          totals: stored.totals,
        },
      });
      expect(noLookupOwed.ok).toBe(false);

      expect(
        (await repos.transitions.apply(stored.id, { action: "escalate", reason: "x" })).ok,
      ).toBe(false);

      expect(await eventsOf(stored.id)).toEqual(before);
      const unchanged = must(await repos.lookup.findByReference("bid", stored.reference));
      expect(unchanged?.record.status).toBe("pending");
    });

    it("refuses a send completed with the wrong lease token, and an unknown document", async () => {
      const stored = await sending();
      const wrong = await repos.transitions.apply(stored.id, {
        action: "complete_sending",
        leaseToken: "someone-else",
        outcome: { status: "unknown" },
      });
      expect(wrong.ok).toBe(false);
      if (!wrong.ok) expect(wrong.refusal.code).toBe("lease_mismatch");
      const missing = await repos.transitions.apply(randomUUID(), { action: "cancel" });
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.refusal.code).toBe("not_found");
    });

    it("leaves a document alone when a lookup is unavailable", async () => {
      const stored = await sending();
      nowMs = T0 + LEASE_MS + 1;
      must(await repos.transitions.apply(stored.id, { action: "expire_lease" }));
      const before = await eventsOf(stored.id);
      const same = must(
        await repos.transitions.apply(stored.id, {
          action: "apply_lookup",
          outcome: { status: "unavailable", reason: "timeout" },
        }),
      );
      expect(same.record.status).toBe("unknown");
      expect(await eventsOf(stored.id)).toEqual(before);
    });

    it("two simultaneous transitions on one document: one wins, the other is refused", async () => {
      const { stored } = await register(invoice("bid", newId()));
      const results = await Promise.all([
        repos.transitions.apply(stored.id, { action: "cancel" }),
        repos.transitions.apply(stored.id, { action: "cancel" }),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect((await eventsOf(stored.id)).filter((e) => e.startsWith("cancel"))).toHaveLength(1);
    });
  });

  describe("due work (retries with backoff, then a person)", () => {
    const due = (prefixes: readonly string[] = ["zoho_books_rate_limited_"]) =>
      repos.dueWork.listDue({
        provider: PROVIDER,
        targetModes: ["dry_run"],
        transientErrorPrefixes: prefixes,
        limit: 1000,
      });
    const dueIds = async (prefixes?: readonly string[]) =>
      (await due(prefixes)).documents.map((d) => d.id);

    async function sentAndAnswered(outcome: "unknown" | { reason: string }) {
      const { stored } = await register(invoice("bid", newId()));
      const claimed = must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "due",
          leaseMs: LEASE_MS,
          targetModes: ["dry_run"],
        }),
      );
      expect(claimed?.id).toBe(stored.id);
      must(
        await repos.transitions.apply(stored.id, {
          action: "complete_sending",
          leaseToken: "due",
          outcome:
            outcome === "unknown"
              ? { status: "unknown" }
              : { status: "rejected", reason: outcome.reason },
        }),
      );
      return stored.id;
    }

    it("an unknown outcome is due for lookup only once it has settled and the first wait has passed", async () => {
      const id = await sentAndAnswered("unknown");
      const settles = T0 + LEASE_MS + SETTLE_GRACE_MS;
      nowMs = settles + 29_000;
      expect(await dueIds()).not.toContain(id);
      nowMs = settles + 30_000;
      expect(await dueIds()).toContain(id);
    });

    it("a passing refusal is retried after its wait; any other refusal waits for a person", async () => {
      const passing = await sentAndAnswered({ reason: "zoho_books_rate_limited_http_429" });
      const lasting = await sentAndAnswered({ reason: "zoho_books_mapping_no_tax_id" });
      nowMs = T0 + 29_000;
      expect(await dueIds()).not.toContain(passing);
      nowMs = T0 + 30_000;
      const ids = await dueIds();
      expect(ids).toContain(passing);
      expect(ids).not.toContain(lasting);
      // A prefix is matched literally: "_" is not a wildcard.
      expect(await dueIds(["zoho_books_rate_limited"])).toContain(passing);
      expect(await dueIds(["zoho%"])).not.toContain(passing);
    });

    it("waits longer after each attempt, and a document out of attempts is due at once", async () => {
      const id = await sentAndAnswered({ reason: "zoho_books_rate_limited_http_429" });
      await owner.execute(sql`update accounting_document set attempts = 3 where id = ${id}`);
      nowMs = T0 + 119_000;
      expect(await dueIds()).not.toContain(id);
      nowMs = T0 + 120_000;
      expect(await dueIds()).toContain(id);
      await owner.execute(sql`update accounting_document set attempts = 8 where id = ${id}`);
      nowMs = T0;
      expect(await dueIds()).toContain(id);
    });

    it("lists only the modes asked for", async () => {
      const id = await sentAndAnswered("unknown");
      nowMs = T0 + 10 * 60_000;
      const other = await repos.dueWork.listDue({
        provider: PROVIDER,
        targetModes: ["test_org", "live"],
        transientErrorPrefixes: [],
        limit: 1000,
      });
      expect(other.documents.map((d) => d.id)).not.toContain(id);
    });
  });

  describe("claiming by target mode", () => {
    it("a rehearsal-only sender never takes a document aimed at a test organisation", async () => {
      await setModes("test_org");
      const doc = await register(invoice("bid", newId()));
      const dryOnly = await repos.workQueue.claimNext({
        provider: PROVIDER,
        leaseToken: "m",
        leaseMs: LEASE_MS,
        targetModes: ["dry_run"],
      });
      expect(must(dryOnly)).toBeNull();
      const none = await repos.workQueue.claimNext({
        provider: PROVIDER,
        leaseToken: "m",
        leaseMs: LEASE_MS,
        targetModes: [],
      });
      expect(must(none)).toBeNull();
      const testOrg = await repos.workQueue.claimNext({
        provider: PROVIDER,
        leaseToken: "m",
        leaseMs: LEASE_MS,
        targetModes: ["test_org"],
      });
      expect(must(testOrg)?.id).toBe(doc.stored.id);
    });
  });

  describe("staff view and try again (Finance › Accounting)", () => {
    // The page runs as the Bid API role when it is configured, so its grants are exercised too.
    const api = createDb(API_URL || (OWNER_URL as string));
    const staff = createAccountingRepositories(api, clock);
    afterAll(async () => {
      await closeDb(api);
    });

    async function refused(reason: string, product: Product = "bid") {
      const { stored } = await register(invoice(product, newId()));
      must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "tok",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      return must(
        await repos.transitions.apply(stored.id, {
          action: "complete_sending",
          leaseToken: "tok",
          outcome: { status: "rejected", reason },
        }),
      );
    }

    async function idsIn(tab: "needs_person" | "failed" | "waiting" | "issued", entity = null) {
      const page = await staff.browser.list({ tab, legalEntity: entity, limit: 500, offset: 0 });
      return page.documents.map((d) => d.id);
    }

    it("lists each document in its tab, a locked period with the documents that need a person", async () => {
      const before = await staff.browser.list({
        tab: "failed",
        legalEntity: null,
        limit: 1,
        offset: 0,
      });
      const plain = await refused("zoho_books_validation_invalid_request");
      const locked = await refused("zoho_books_validation_period_locked");
      expect(await idsIn("failed")).toContain(plain.id);
      expect(await idsIn("failed")).not.toContain(locked.id);
      expect(await idsIn("needs_person")).toContain(locked.id);
      const after = await staff.browser.list({
        tab: "failed",
        legalEntity: null,
        limit: 1,
        offset: 0,
      });
      expect(after.counts.failed).toBe(before.counts.failed + 1);
      expect(after.counts.needs_person).toBe(before.counts.needs_person + 1);
      expect(after.total).toBe(after.counts.failed);
      expect(after.documents).toHaveLength(1);
    });

    it("filters by company", async () => {
      const shop = await refused("zoho_books_validation_invalid_request", "shop");
      const art = (
        await staff.browser.list({
          tab: "failed",
          legalEntity: "london_art_exchange",
          limit: 500,
          offset: 0,
        })
      ).documents;
      expect(art.map((d) => d.id)).toContain(shop.id);
      expect(art.every((d) => d.legalEntity === "london_art_exchange")).toBe(true);
      const bid = await staff.browser.list({
        tab: "failed",
        legalEntity: "london_auction_xchange",
        limit: 500,
        offset: 0,
      });
      expect(bid.documents.map((d) => d.id)).not.toContain(shop.id);
    });

    async function issued(number: string, product: Product = "bid") {
      const { stored } = await register(invoice(product, newId()));
      must(
        await repos.workQueue.claimNext({
          provider: PROVIDER,
          leaseToken: "tok",
          leaseMs: LEASE_MS,
          targetModes: ALL_MODES,
        }),
      );
      return must(
        await repos.transitions.apply(stored.id, {
          action: "complete_sending",
          leaseToken: "tok",
          outcome: {
            status: "issued",
            number,
            providerId: `books-${number}`,
            pdfRef: null,
            totals: stored.totals,
          },
        }),
      );
    }

    it("counts today's issued documents, names the last one sent, and finds one by reference", async () => {
      const done = await issued("INV-TODAY");
      const page = await staff.browser.list({
        tab: "issued",
        legalEntity: null,
        limit: 500,
        offset: 0,
      });
      expect(page.documents.map((d) => d.id)).toContain(done.id);
      expect(page.issuedToday).toBeGreaterThanOrEqual(1);
      expect(page.lastSent).not.toBeNull();
      expect(page.lastSent?.rehearsal).toBe(done.target?.mode === "dry_run");

      const byRef = await staff.browser.list({
        tab: "issued",
        legalEntity: null,
        reference: done.reference,
        limit: 50,
        offset: 0,
      });
      expect(byRef.documents.map((d) => d.id)).toEqual([done.id]);
      expect(byRef.total).toBe(1);

      const none = await staff.browser.list({
        tab: "issued",
        legalEntity: null,
        reference: "LAX-BID-INV-does-not-exist",
        limit: 50,
        offset: 0,
      });
      expect(none.documents).toEqual([]);
      expect(none.total).toBe(0);
    });

    it("tries the same document again under the same reference, records who asked, and only once", async () => {
      const failed = await refused("zoho_books_validation_invalid_request");
      const again = must(
        await staff.transitions.apply(failed.id, { action: "requeue", requestedBy: "staff-1" }),
      );
      expect(again.id).toBe(failed.id);
      expect(again.reference).toBe(failed.reference);
      expect(again.record.status).toBe("pending");
      expect(again.lastErrorClass).toBe("zoho_books_validation_invalid_request");
      const second = await staff.transitions.apply(failed.id, {
        action: "requeue",
        requestedBy: "staff-1",
      });
      expect(second.ok).toBe(false);
      const history = await owner.execute<{ action: string; detail: Record<string, unknown> }>(
        sql`select action, detail from accounting_document_event
            where document_id = ${failed.id} and action = 'requeue'`,
      );
      expect(history.rows).toEqual([{ action: "requeue", detail: { requestedBy: "staff-1" } }]);
      const count = await owner.execute<{ n: number }>(
        sql`select count(*)::int as n from accounting_document where lax_reference = ${failed.reference}`,
      );
      expect(count.rows[0]?.n).toBe(1);
      expect(must(await staff.browser.findById(failed.id))?.record.status).toBe("pending");
      expect(must(await staff.browser.findById(randomUUID()))).toBeNull();
    });

    it("reports how long work has waited for a person and for the sender", async () => {
      await refused("zoho_books_validation_period_locked");
      const attention = await staff.attention.read(["dry_run"]);
      expect(attention.needsPerson.count).toBeGreaterThan(0);
      expect(attention.needsPerson.oldestSince).toBeInstanceOf(Date);
      await register(invoice("bid", newId()));
      const waiting = await staff.attention.read(["dry_run"]);
      expect(waiting.pending.count).toBeGreaterThan(0);
      expect((await staff.attention.read([])).pending).toEqual({ count: 0, oldestSince: null });
    });
  });

  describe("history is append-only", () => {
    async function oneEventId() {
      const { stored } = await register(invoice("bid", newId()));
      const rows = await owner.execute<{ id: string }>(
        sql`select id from accounting_document_event where document_id = ${stored.id}`,
      );
      return { documentId: stored.id, id: rows.rows[0]?.id as string };
    }

    it("refuses UPDATE, DELETE and TRUNCATE even to the owner", async () => {
      const { id } = await oneEventId();
      expect(
        await rejectedCode(
          owner.execute(
            sql`update accounting_document_event set action = 'cancel' where id = ${id}`,
          ),
        ),
      ).toBe("23001");
      expect(
        await rejectedCode(
          owner.execute(sql`delete from accounting_document_event where id = ${id}`),
        ),
      ).toBe("23001");
      expect(await rejectedCode(owner.execute(sql`truncate accounting_document_event`))).toBe(
        "23001",
      );
    });

    it.skipIf(!WORKER_URL)(
      "lets the worker add history but not read, change or delete it",
      async () => {
        const { id, documentId } = await oneEventId();
        await worker.execute(sql`
        insert into accounting_document_event (document_id, action, from_state, to_state, attempts, occurred_at)
        values (${documentId}, 'cancel', 'pending', 'cancelled', 0, now())`);
        for (const statement of [
          sql`update accounting_document_event set action = 'cancel' where id = ${id}`,
          sql`delete from accounting_document_event where id = ${id}`,
          sql`select id from accounting_document_event`,
        ]) {
          expect(await rejectedCode(worker.execute(statement))).toBe("42501");
        }
      },
    );

    it.skipIf(!API_URL)(
      "lets the Bid API read history and add only a requeue, never change it, and never rewrite or forge a document",
      async () => {
        // biome-ignore lint/style/noNonNullAssertion: gated by API_URL
        const api = createDb(API_URL!);
        try {
          const { id, documentId } = await oneEventId();
          const read = await api.execute(
            sql`select id from accounting_document_event where id = ${id}`,
          );
          expect(read.rows).toHaveLength(1);
          for (const statement of [
            sql`update accounting_document_event set action = 'cancel' where id = ${id}`,
            sql`delete from accounting_document_event where id = ${id}`,
            sql`update accounting_document set gross_pence = 1 where id = ${documentId}`,
            sql`update accounting_document set provider = 'xero' where id = ${documentId}`,
            // The requeue columns are grantable, but a trigger allows only the requeue itself.
            sql`update accounting_document set state = 'issued', provider_id = 'ATTACKER-9', provider_number = 'INV-FORGED' where id = ${documentId}`,
            sql`insert into accounting_document_event (document_id, action, from_state, to_state, attempts, detail, occurred_at)
              values (${documentId}, 'complete_sending', 'sending', 'issued', 1, '{"requestedBy":"not-real"}', now())`,
            sql`delete from accounting_document where id = ${documentId}`,
            sql`insert into accounting_document (product, legal_entity, kind, lax_reference, source_event_ref, payload, net_pence, vat_pence, gross_pence)
              values ('bid', 'london_auction_xchange', 'invoice', 'LAX-BID-INV-x', 'e', '{}', 1, 0, 1)`,
          ]) {
            expect(await rejectedCode(api.execute(statement))).toBe("42501");
          }
          const documents = await api.execute(
            sql`select id from accounting_document where id = ${documentId}`,
          );
          expect(documents.rows).toHaveLength(1);
        } finally {
          await closeDb(api);
        }
      },
    );

    it.skipIf(!WORKER_URL)("never lets the worker delete a document", async () => {
      const { documentId } = await oneEventId();
      expect(
        await rejectedCode(
          worker.execute(sql`delete from accounting_document where id = ${documentId}`),
        ),
      ).toBe("42501");
    });
  });

  describe("source switch", () => {
    // The API role is read-only on the switch until a staff route exists, so the writer runs as owner.
    const settingsDb = createDb(OWNER_URL as string);
    const settings = createAccountingRepositories(settingsDb, clock);

    async function restoreSeed() {
      await owner.execute(sql`
        insert into accounting_source_setting (product, xero_mode, books_mode) values
          ('bid', 'live', 'off'), ('shop', 'off', 'off'), ('lax_art', 'off', 'off')
        on conflict (product) do update set xero_mode = excluded.xero_mode, books_mode = excluded.books_mode`);
    }
    beforeEach(restoreSeed);
    afterAll(async () => {
      await restoreSeed();
      await closeDb(settingsDb);
    });

    it("reads today's reality: Bid on Xero, Shop and lax.art on none, Books off", async () => {
      const config = must(await settings.settingReader.read());
      expect(config).toEqual({
        bid: { xero: "live", books: "off" },
        shop: { xero: "off", books: "off" },
        lax_art: { xero: "off", books: "off" },
      });
      // The worker reads the same switch with its read-only grant.
      const asWorker = must(await repos.settingReader.read());
      expect(asWorker).toEqual(config);
    });

    it("refuses a second live source through the domain, and changes nothing", async () => {
      const refused = await settings.settingWriter.update({
        product: "bid",
        books: "live",
        updatedBy: "staff-1",
      });
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.refusal.code).toBe("two_live_sources");
      expect(must(await settings.settingReader.read()).bid).toEqual({ xero: "live", books: "off" });
    });

    it("lets Books go live only once Xero is not, and records who changed it", async () => {
      const dry = must(
        await settings.settingWriter.update({
          product: "bid",
          books: "dry_run",
          updatedBy: "staff-1",
        }),
      );
      expect(dry.bid).toEqual({ xero: "live", books: "dry_run" });
      must(
        await settings.settingWriter.update({ product: "bid", xero: "off", updatedBy: "staff-2" }),
      );
      const live = must(
        await settings.settingWriter.update({
          product: "bid",
          books: "live",
          updatedBy: "staff-2",
        }),
      );
      expect(live.bid).toEqual({ xero: "off", books: "live" });
      const row = await owner.execute<{ live_source: string; updated_by: string }>(
        sql`select live_source, updated_by from accounting_source_setting where product = 'bid'`,
      );
      expect(row.rows[0]).toEqual({ live_source: "books", updated_by: "staff-2" });
    });

    it("is held by the database too: two live sources cannot be written around the repository", async () => {
      expect(
        await rejectedCode(
          owner.execute(
            sql`update accounting_source_setting set books_mode = 'live' where product = 'bid'`,
          ),
        ),
      ).toBe("23514");
    });

    it("refuses to read a configuration with a product missing", async () => {
      await owner.execute(sql`delete from accounting_source_setting where product = 'shop'`);
      const read = await settings.settingReader.read();
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.refusal.code).toBe("missing_product");
    });

    it.skipIf(!WORKER_URL)("does not let the worker change the switch", async () => {
      expect(
        await rejectedCode(
          worker.execute(
            sql`update accounting_source_setting set books_mode = 'dry_run' where product = 'shop'`,
          ),
        ),
      ).toBe("42501");
    });
  });
});
