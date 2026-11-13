import { randomUUID } from "node:crypto";
import {
  type AccountingDocument,
  type Product,
  buildInvoice,
  laxReference,
} from "@auction/accounting-domain";
import { closeDb, createDb } from "@auction/db";
import { createAccountingRepositories } from "@auction/persistence/repositories";
import type { StaffRoles } from "@auction/types";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createAccountingQueue } from "../../../container/create-accounting-queue.js";
import { requireFinanceAccess } from "../../../middleware/require-capability.js";
import type { AdminHono } from "../../../routes/admin/_shared.js";
import { attachAdminAccountingRoutes } from "../../../routes/admin/accounting.routes.js";
import { mockDomainEventSink } from "../../../test/domain-event-sink-mock.js";
import { createTestStaffGuards } from "../../../testing/staff-mutation-guards.js";

type Body = {
  data: {
    rows: Record<string, unknown>[] & { id: string; organisation: string; problem: string }[];
    total: number;
    counts: Record<string, number>;
    outcome: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
const read = (res: Response) => res.json() as Promise<Body>;

const OWNER_URL = process.env.DATABASE_URL;
const API_URL = process.env.DATABASE_URL_API;
const HAS_DB = Boolean(OWNER_URL);

const newId = () => randomUUID().replaceAll("-", "").slice(0, 16);

function invoice(product: Product, sourceId: string): AccountingDocument {
  const contact = laxReference(product, "contact", sourceId);
  if (!contact.ok) throw new Error(contact.refusal.message);
  const built = buildInvoice({
    product,
    sourceId,
    contactReference: contact.value,
    issuedOn: "2026-11-02",
    dueOn: "2026-11-16",
    lines: [
      {
        description: "Lot 1",
        quantity: 1,
        unitNetPence: 12_500,
        treatment: "standard",
        role: "goods",
      },
    ],
  });
  if (!built.ok) throw new Error(built.refusal.message);
  return built.value;
}

describe.skipIf(!HAS_DB)("Finance › Accounting API (integration)", { timeout: 60_000 }, () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const owner = createDb(OWNER_URL!);
  // The page runs as the Bid API role when it is configured, so its grants are exercised too.
  const api = createDb(API_URL || (OWNER_URL as string));
  const seeding = createAccountingRepositories(owner, { now: () => new Date() });
  const publish = vi.fn().mockResolvedValue(undefined);
  const { accountingQueue } = createAccountingQueue({
    db: api,
    domainEventSink: mockDomainEventSink(publish),
    env: {},
  });

  function app(staffRoles: StaffRoles = ["finance"]) {
    const hono: AdminHono = new Hono();
    hono.use("*", async (c, next) => {
      c.set("userId", "staff-7");
      c.set("identitySessionId", "session-7");
      c.set("userRole", "staff");
      c.set("userStaffRoles", staffRoles);
      await next();
    });
    hono.use("/finance/*", requireFinanceAccess);
    attachAdminAccountingRoutes(
      hono,
      { admin: { accountingQueue } } as never,
      createTestStaffGuards({ recent: true }),
    );
    return hono;
  }

  let savedSwitch: { product: string; xero_mode: string; books_mode: string }[] = [];

  /** A document Books refused, the way the sender leaves it. */
  async function refused(product: Product, reason: string) {
    const registered = await seeding.registry.register({
      document: invoice(product, newId()),
      sourceEventRef: `evt-${newId()}`,
    });
    if (!registered.ok) throw new Error(registered.refusal.message);
    const { stored } = registered.value;
    const token = `tok-${newId()}`;
    await owner.execute(sql`
      update accounting_document set state = 'sending', provider = 'books', attempts = 1, lease_token = ${token},
             lease_expires_at = now() + interval '1 minute'
       where id = ${stored.id}`);
    const done = await seeding.transitions.apply(stored.id, {
      action: "complete_sending",
      leaseToken: token,
      outcome: { status: "rejected", reason },
    });
    if (!done.ok) throw new Error(done.refusal.message);
    return done.value;
  }

  function tryAgain(hono: AdminHono, id: string, key: string) {
    return hono.request(`/finance/accounting/${id}/try-again`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
    });
  }

  beforeAll(async () => {
    const rows = await owner.execute<{ product: string; xero_mode: string; books_mode: string }>(
      sql`select product, xero_mode, books_mode from accounting_source_setting`,
    );
    savedSwitch = rows.rows;
    // Books in rehearsal for every product, so registered documents get a dry-run target.
    await owner.execute(sql`
      update accounting_source_setting set books_mode = 'dry_run',
             xero_mode = case when xero_mode = 'live' then 'off' else xero_mode end`);
  });

  afterAll(async () => {
    for (const row of savedSwitch) {
      await owner.execute(sql`
        update accounting_source_setting set xero_mode = ${row.xero_mode}, books_mode = ${row.books_mode}
         where product = ${row.product}`);
    }
    await closeDb(api);
    await closeDb(owner);
  });

  it("tries a refused document again under the same reference, once, and records who asked", async () => {
    const failed = await refused("bid", "zoho_books_mapping_no_tax_id");
    const hono = app(["finance"]);

    const first = await tryAgain(hono, failed.id, `key-${newId()}`);
    expect(first.status).toBe(200);
    expect((await read(first)).data).toEqual({
      id: failed.id,
      reference: failed.reference,
      outcome: "requeued",
    });

    // A second press with a new key (another tab, a double click after a reload) changes nothing.
    const second = await tryAgain(hono, failed.id, `key-${newId()}`);
    expect(second.status).toBe(200);
    expect((await read(second)).data.outcome).toBe("already_queued");

    const documents = await owner.execute<{ id: string; state: string }>(
      sql`select id, state from accounting_document where lax_reference = ${failed.reference}`,
    );
    expect(documents.rows).toEqual([{ id: failed.id, state: "pending" }]);
    const history = await owner.execute<{ detail: Record<string, unknown> }>(
      sql`select detail from accounting_document_event
           where document_id = ${failed.id} and action = 'requeue'`,
    );
    expect(history.rows).toEqual([{ detail: { requestedBy: "staff-7" } }]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "accounting_document.retry_requested",
        aggregateId: failed.id,
        actorUserId: "staff-7",
        payload: expect.objectContaining({ reference: failed.reference, fromState: "failed" }),
      }),
    );
  });

  it("refuses an unknown document and one the permission does not cover", async () => {
    const hono = app(["finance"]);
    expect((await tryAgain(hono, randomUUID(), `key-${newId()}`)).status).toBe(404);
    const failed = await refused("bid", "zoho_books_mapping_mixed_basis");
    expect((await tryAgain(app(["sales_manager"]), failed.id, `key-${newId()}`)).status).toBe(403);
    const state = await owner.execute<{ state: string }>(
      sql`select state from accounting_document where id = ${failed.id}`,
    );
    expect(state.rows[0]?.state).toBe("failed");
  });

  it("lists by tab and company, words problems, and puts a locked period with Needs a person", async () => {
    const shop = await refused("shop", "zoho_books_mapping_vat_differs_from_books");
    const locked = await refused("bid", "zoho_books_validation_period_locked");
    const hono = app(["finance"]);

    const art = await read(
      await hono.request(
        "/finance/accounting?tab=failed&organisation=london_art_exchange&limit=100",
      ),
    );
    const row = art.data.rows.find((r: { id: string }) => r.id === shop.id);
    expect(row).toMatchObject({
      reference: shop.reference,
      documentType: "invoice",
      product: "shop",
      organisation: "london_art_exchange",
      problem: "Books would work out a different VAT for a line than LAX did.",
      canTryAgain: true,
      lockedPeriod: false,
    });
    expect(
      art.data.rows.every(
        (r: { organisation: string }) => r.organisation === "london_art_exchange",
      ),
    ).toBe(true);
    expect(art.data.total).toBe(art.data.counts.failed);

    const bid = await read(
      await hono.request(
        "/finance/accounting?tab=failed&organisation=london_auction_xchange&limit=100",
      ),
    );
    expect(bid.data.rows.map((r: { id: string }) => r.id)).not.toContain(shop.id);

    const person = await read(await hono.request("/finance/accounting?tab=needs_person&limit=100"));
    const lockedRow = person.data.rows.find((r: { id: string }) => r.id === locked.id);
    expect(lockedRow).toMatchObject({ lockedPeriod: true });
    expect(lockedRow?.problem).toContain("today's date");

    const page = await read(await hono.request("/finance/accounting?tab=failed&limit=1&offset=0"));
    expect(page.data.rows).toHaveLength(1);
    expect(page.data).toMatchObject({ limit: 1, offset: 0 });
  });
});
