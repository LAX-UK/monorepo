import { randomUUID } from "node:crypto";
import { type Database, createDb } from "@auction/db";
import {
  artworkRegister,
  itemSubmission,
  legalEntity,
  privateSaleDeal,
  user,
} from "@auction/db/schema";
import { settlementFollowUp } from "@auction/domain";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleDealSettlementFollowUpMarker } from "./drizzle-deal-settlement-follow-up.marker.js";
import { DrizzlePrivateSaleDealQueryRepository } from "./drizzle-private-sale-deal-query.repository.js";
import { DrizzlePrivateSaleDealRepository } from "./drizzle-private-sale-deal.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

type OfferState = "held" | "lax_art" | "bid_sale" | "private_sale" | "sold" | "withdrawn";
type RefKind = "shop_artwork" | "bid_lot" | "private_sale" | "gallery_sale";

describe.skipIf(!HAS_DB)("settled deals whose artwork is not marked sold (integration)", () => {
  const ownerId = "psf-it-owner";
  const otherId = "psf-it-other";
  const sellerUserId = "psf-it-seller";
  const sellerEntityId = "a0e00000-0000-4000-8000-0000000000b1";
  const t = new Date("2026-10-01T00:00:00Z");

  /** Runs in a transaction that is always rolled back. */
  async function inRollback(run: (db: Database) => Promise<void>) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");
    const db = createDb(databaseUrl);
    const rollback = new Error("rollback_settlement_follow_up_test");
    try {
      await db.transaction(async (tx) => {
        for (const id of [ownerId, otherId, sellerUserId]) {
          await tx.insert(user).values({
            id,
            name: id,
            email: `${id}@integration.test`,
            emailVerified: true,
            createdAt: t,
            updatedAt: t,
          });
        }
        await tx.insert(legalEntity).values({
          id: sellerEntityId,
          displayName: "Henry Lowe",
          kind: "organisation",
          subkind: "company",
          createdByUserId: sellerUserId,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        });
        await run(tx as unknown as Database);
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  }

  async function register(
    db: Database,
    place: {
      kind?: "original" | "print";
      state?: OfferState;
      ref?: { kind: RefKind; id: string } | null;
    } = {},
  ): Promise<string> {
    const key = randomUUID().slice(0, 8);
    const digits = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
    const [row] = await db
      .insert(artworkRegister)
      .values({
        zohoProductId: `psf-${key}`,
        stockCode: `LAX-${place.kind === "print" ? "PRT" : "ORI"}-PS-GA-26-${digits}`,
        kind: place.kind ?? "original",
        title: "Evening Tide",
        artistName: "Hannah Cole",
        artistCode: "HC",
        offerState: place.state ?? "held",
        offerRefKind: place.ref?.kind ?? null,
        offerRefId: place.ref?.id ?? null,
      })
      .returning({ id: artworkRegister.id });
    return row?.id as string;
  }

  async function dealFor(
    db: Database,
    over: { stage?: string; owner?: string; artwork?: string | null } = {},
  ): Promise<{ id: string; reference: string }> {
    const [submission] = await db
      .insert(itemSubmission)
      .values({
        legalEntityId: sellerEntityId,
        title: "Evening Tide",
        status: "draft",
        submittedByUserId: sellerUserId,
      })
      .returning({ id: itemSubmission.id });
    const deal = await new DrizzlePrivateSaleDealRepository(db).create({
      itemSubmissionId: submission?.id as string,
      ownerUserId: over.owner ?? ownerId,
      seller: { legalEntityId: sellerEntityId, actingUserId: sellerUserId },
      buyerFeeBps: 0,
      sellerCommissionBps: null,
      actorUserId: ownerId,
    });
    await db
      .update(privateSaleDeal)
      .set({
        stage: over.stage ?? "settled",
        artworkRegisterId: over.artwork ?? null,
        // What the table requires of a deal that has been agreed, invoiced and paid.
        priceMinor: 4_800_000,
        agreedAt: t,
        vatTreatment: "margin_scheme",
        sellerCommissionBps: 1500,
        paymentDueAt: t,
      })
      .where(eq(privateSaleDeal.id, deal.id));
    return { id: deal.id, reference: deal.reference };
  }

  it("finds exactly the settled originals the register does not show as sold through the deal", async () => {
    await inRollback(async (db) => {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const deal = (artwork: string | null, stage = "settled") => dealFor(db, { artwork, stage });
      // Placeholder ids are replaced below: a deal's own id is the reference of its sold record.
      const recorded = await deal(null);
      const recordedArt = await register(db, {
        state: "sold",
        ref: { kind: "private_sale", id: recorded.id },
      });
      await db
        .update(privateSaleDeal)
        .set({ artworkRegisterId: recordedArt })
        .where(eq(privateSaleDeal.id, recorded.id));

      const held = await deal(await register(db, { state: "held" }));
      const withdrawn = await deal(await register(db, { state: "withdrawn" }));
      const stillHeld = await dealFor(db, { artwork: null });
      await db
        .update(privateSaleDeal)
        .set({
          artworkRegisterId: await register(db, {
            state: "private_sale",
            ref: { kind: "private_sale", id: stillHeld.id },
          }),
        })
        .where(eq(privateSaleDeal.id, stillHeld.id));
      const inSale = await deal(
        await register(db, { state: "bid_sale", ref: { kind: "bid_lot", id: "lot-1" } }),
      );
      const soldInGallery = await deal(
        await register(db, { state: "sold", ref: { kind: "gallery_sale", id: "zoho-1" } }),
      );
      const otherDeal = await deal(
        await register(db, {
          state: "sold",
          ref: { kind: "private_sale", id: randomUUID() },
        }),
      );
      const print = await deal(await register(db, { kind: "print", state: "held" }));
      const unlinked = await deal(null);
      const notSettled = await deal(await register(db, { state: "held" }), "paid");

      const open = await queries.listSettlementFollowUps({ kind: "all" }, 100);
      const severityOf = new Map(open.map((row) => [row.dealId, row.severity]));
      expect(severityOf.get(held.id)).toBe("normal");
      expect(severityOf.get(withdrawn.id)).toBe("normal");
      expect(severityOf.get(stillHeld.id)).toBe("normal");
      expect(severityOf.get(inSale.id)).toBe("urgent");
      expect(severityOf.get(soldInGallery.id)).toBe("urgent");
      expect(severityOf.get(otherDeal.id)).toBe("urgent");
      for (const clear of [recorded, print, unlinked, notSettled]) {
        expect(severityOf.has(clear.id), clear.reference).toBe(false);
      }
    });
  });

  it("lists the same deals in the needs attention view, with the same severity in every view", async () => {
    await inRollback(async (db) => {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const held = await dealFor(db, { artwork: await register(db, { state: "held" }) });
      const urgent = await dealFor(db, {
        artwork: await register(db, { state: "lax_art", ref: { kind: "shop_artwork", id: "s1" } }),
      });
      const clear = await dealFor(db);
      const filter = { viewerUserId: ownerId, scope: { kind: "all" } as const, limit: 100 };

      const attention = await queries.list({ ...filter, view: "needs_attention" });
      expect(attention.map((row) => row.id).sort()).toEqual([held.id, urgent.id].sort());
      expect(attention.find((row) => row.id === urgent.id)?.settlementFollowUp).toBe("urgent");

      // The same rule, evaluated per row, in the all view and the settled view.
      for (const view of ["all", "settled"] as const) {
        const rows = await queries.list({ ...filter, view });
        const severity = (id: string) => rows.find((row) => row.id === id)?.settlementFollowUp;
        expect(severity(held.id)).toBe("normal");
        expect(severity(urgent.id)).toBe("urgent");
        expect(severity(clear.id)).toBeNull();
      }
    });
  });

  it("is cut to the deals a person may see", async () => {
    await inRollback(async (db) => {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const mine = await dealFor(db, { artwork: await register(db), owner: ownerId });
      const theirs = await dealFor(db, { artwork: await register(db), owner: otherId });
      const owned = await queries.listSettlementFollowUps({ kind: "owned", userId: ownerId }, 100);
      expect(owned.map((row) => row.dealId)).toContain(mine.id);
      expect(owned.map((row) => row.dealId)).not.toContain(theirs.id);
      const stages = await queries.listSettlementFollowUps(
        { kind: "stages", stages: ["paid"] },
        100,
      );
      expect(stages.map((row) => row.dealId)).not.toContain(mine.id);
    });
  });

  it("clears itself the moment the register shows the artwork sold through the deal", async () => {
    await inRollback(async (db) => {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const art = await register(db, { state: "held" });
      const deal = await dealFor(db, { artwork: art });
      const ids = async () =>
        (await queries.listSettlementFollowUps({ kind: "all" }, 100)).map((row) => row.dealId);
      expect(await ids()).toContain(deal.id);
      await db
        .update(artworkRegister)
        .set({ offerState: "sold", offerRefKind: "private_sale", offerRefId: deal.id })
        .where(eq(artworkRegister.id, art));
      expect(await ids()).not.toContain(deal.id);
    });
  });

  it("raises a deal once: the claim is taken by the first caller only", async () => {
    await inRollback(async (db) => {
      const marker = new DrizzleDealSettlementFollowUpMarker();
      const deal = await dealFor(db, { artwork: await register(db) });
      expect(await marker.claimInTransaction(db, deal.id)).toBe(true);
      // The claim is read from the audit log, so it holds once the event is written.
      await db.execute(
        sql`INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
            VALUES ('private_sale_deal', ${deal.id}, 'private_sale_deal.settlement_follow_up_raised', '{}'::jsonb, 'apps/api')`,
      );
      expect(await marker.claimInTransaction(db, deal.id)).toBe(false);
      const another = await dealFor(db, { artwork: await register(db) });
      expect(await marker.claimInTransaction(db, another.id)).toBe(true);
    });
  });

  it("agrees with the domain rule on every combination of state and reference, NULL refs included", async () => {
    await inRollback(async (db) => {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const states: OfferState[] = [
        "held",
        "lax_art",
        "bid_sale",
        "private_sale",
        "sold",
        "withdrawn",
      ];
      const refs = (id: string): ({ kind: RefKind; id: string } | null)[] => [
        null,
        { kind: "shop_artwork", id: "s1" },
        { kind: "bid_lot", id: "l1" },
        { kind: "private_sale", id },
        { kind: "private_sale", id: randomUUID() },
        { kind: "gallery_sale", id: "z1" },
      ];
      const cases: { id: string; state: OfferState; kind: "original" | "print"; ref: string }[] =
        [];
      for (const kind of ["original", "print"] as const) {
        for (const state of states) {
          for (let r = 0; r < 6; r++) {
            // Combinations the register's own constraints forbid cannot exist; skip them.
            const deal = await dealFor(db, { artwork: null });
            const ref = refs(deal.id)[r] ?? null;
            const allowed =
              state === "sold" ||
              (state === "lax_art" && ref?.kind === "shop_artwork") ||
              (state === "bid_sale" && ref?.kind === "bid_lot") ||
              (state === "private_sale" && ref?.kind === "private_sale") ||
              ((state === "held" || state === "withdrawn") && ref === null);
            if (!allowed) continue;
            const art = await register(db, { kind, state, ref });
            await db
              .update(privateSaleDeal)
              .set({ artworkRegisterId: art })
              .where(eq(privateSaleDeal.id, deal.id));
            cases.push({ id: deal.id, state, kind, ref: ref ? `${ref.kind}` : "null" });
          }
        }
      }
      expect(cases.length).toBeGreaterThanOrEqual(24);
      const rows = await queries.list({
        view: "settled",
        viewerUserId: ownerId,
        scope: { kind: "all" },
        limit: 1000,
      });
      const listed = new Map(
        (await queries.listSettlementFollowUps({ kind: "all" }, 1000)).map((r) => [
          r.dealId,
          r.severity,
        ]),
      );
      const counted = await queries.countSettlementFollowUps({ kind: "all" });
      let expectedTotal = 0;
      let expectedUrgent = 0;
      for (const c of cases) {
        const row = rows.find((r) => r.id === c.id);
        const expected = row?.settlementFollowUp ?? null;
        // The per-row severity comes from the domain rule; the selection and the aggregate are SQL.
        expect(listed.get(c.id) ?? null, `${c.kind} ${c.state} ${c.ref}`).toBe(expected);
        if (expected) expectedTotal += 1;
        if (expected === "urgent") expectedUrgent += 1;
      }
      // Counted over the test's own deals: the database may hold others, so compare at least.
      expect(counted.total).toBeGreaterThanOrEqual(expectedTotal);
      expect(counted.urgent).toBeGreaterThanOrEqual(expectedUrgent);
      // A sold artwork with no recorded place is urgent, in both.
      const unknown = cases.find(
        (c) => c.kind === "original" && c.state === "sold" && c.ref === "null",
      );
      expect(unknown && listed.get(unknown.id)).toBe("urgent");
      expect(
        settlementFollowUp(
          { id: "d", stage: "settled", artworkRegisterId: "a" },
          { kind: "original", offerState: "sold", offerRefKind: null, offerRefId: null },
        ),
      ).toBe("urgent");
    });
  });

  it("counts without a cap, urgent included, and lists urgent first", async () => {
    await inRollback(async (db) => {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const before = await queries.countSettlementFollowUps({ kind: "all" });
      for (let i = 0; i < 3; i++) await dealFor(db, { artwork: await register(db) });
      const urgent = await dealFor(db, {
        artwork: await register(db, { state: "sold", ref: null }),
      });
      const after = await queries.countSettlementFollowUps({ kind: "all" });
      expect(after.total - before.total).toBe(4);
      expect(after.urgent - before.urgent).toBe(1);
      // Even a window of one holds the urgent deal.
      const [first] = await queries.listSettlementFollowUps({ kind: "all" }, 1);
      expect(first?.severity).toBe("urgent");
      expect(
        (await queries.listSettlementFollowUps({ kind: "all" }, 1000)).map((r) => r.dealId),
      ).toContain(urgent.id);
    });
  });

  it("leaves out deals already raised at their severity, and raises an escalation once more", async () => {
    await inRollback(async (db) => {
      const queries = new DrizzlePrivateSaleDealQueryRepository(db);
      const marker = new DrizzleDealSettlementFollowUpMarker();
      const art = await register(db, { state: "held" });
      const deal = await dealFor(db, { artwork: art });
      const unraised = async () =>
        (await queries.listSettlementFollowUps({ kind: "all" }, 1000, { unraisedOnly: true })).map(
          (r) => r.dealId,
        );
      const raise = (severity: "normal" | "urgent") =>
        db.execute(
          sql`INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, producer)
              VALUES ('private_sale_deal', ${deal.id}, 'private_sale_deal.settlement_follow_up_raised', ${JSON.stringify({ dealId: deal.id, severity })}::jsonb, 'apps/api')`,
        );
      expect(await unraised()).toContain(deal.id);
      expect(await marker.claimInTransaction(db, deal.id, "normal")).toBe(true);
      await raise("normal");
      expect(await unraised()).not.toContain(deal.id);
      expect(await marker.claimInTransaction(db, deal.id, "normal")).toBe(false);

      // The register now shows it somewhere else: urgent, and not yet raised as urgent.
      await db
        .update(artworkRegister)
        .set({ offerState: "bid_sale", offerRefKind: "bid_lot", offerRefId: "lot-1" })
        .where(eq(artworkRegister.id, art));
      expect(await unraised()).toContain(deal.id);
      expect(await marker.claimInTransaction(db, deal.id, "urgent")).toBe(true);
      await raise("urgent");
      expect(await unraised()).not.toContain(deal.id);
      expect(await marker.claimInTransaction(db, deal.id, "urgent")).toBe(false);
      expect(await marker.claimInTransaction(db, deal.id, "normal")).toBe(false);
    });
  });
});
