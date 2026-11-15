import { type Database, createDb } from "@auction/db";
import { user } from "@auction/db/schema";
import { describe, expect, it } from "vitest";
import {
  DrizzleEnquiryNoteRepository,
  DrizzleEnquiryRoutingRepository,
} from "./drizzle-enquiry-workflow.repositories.js";
import { DrizzleMarketingEnquiryRepository } from "./drizzle-marketing-enquiry.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const STAFF = "enquiry-repo-staff";
const base = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "A message that is long enough.",
  marketingOptIn: false,
};

/** Runs in a transaction that is always rolled back. */
async function inRollback(run: (tx: Database, db: Database) => Promise<void>) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  const db = createDb(databaseUrl);
  const rollback = new Error("rollback_enquiry_repo_test");
  try {
    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: STAFF,
        email: "enquiry-repo-staff@example.com",
        name: "Staff",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      await run(tx as unknown as Database, db);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describe.skipIf(!HAS_DB)("enquiry repositories (integration)", () => {
  it("stores a private sale enquiry with its detail and finds it by reference or id", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleMarketingEnquiryRepository(tx);
      const created = await repo.createInTransaction(tx, {
        ...base,
        intent: "private_sale_sell",
        topic: "selling",
        departmentSlug: "paintings",
        privateSale: {
          artist: "David Hockney",
          title: "Pool study",
          medium: null,
          size: null,
          locationTown: "Bath",
          locationCountry: "United Kingdom",
          priceInMindMinor: 4_800_000,
          lookingFor: null,
          budgetBand: null,
          timing: null,
          contactPreference: "either",
        },
      });
      expect(created.reference).toMatch(/^E-\d{4,}$/);
      expect(created).toMatchObject({ status: "new", version: 1, intent: "private_sale_sell" });

      const byReference = await repo.findByRef(created.reference);
      const byId = await repo.findByRef(created.id);
      expect(byId).toEqual(byReference);
      expect(byReference?.privateSale).toMatchObject({
        artist: "David Hockney",
        priceInMindMinor: 4_800_000,
        contactPreference: "either",
      });
      expect(await repo.findByRef("E-0000")).toBeNull();
    });
  });

  it("limits the list to what the scope may see and applies the view", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleMarketingEnquiryRepository(tx);
      const priv = await repo.createInTransaction(tx, {
        ...base,
        intent: "private_sale_buy",
        topic: "buying",
      });
      const general = await repo.createInTransaction(tx, {
        ...base,
        intent: "press",
        topic: "press",
      });
      const assigned = await repo.createInTransaction(tx, {
        ...base,
        intent: "press",
        topic: "press",
        assignedToUserId: STAFF,
      });
      const ids = async (
        scope: { readsGeneral: boolean; readsPrivateSale: boolean },
        view: "open" | "assigned_to_me" | "private_sales" | "unassigned" = "open",
      ) =>
        (
          await repo.list({
            view,
            scope: { viewerUserId: STAFF, ...scope },
            limit: 100,
          })
        ).map((r) => r.id);

      const all = await ids({ readsGeneral: true, readsPrivateSale: true });
      for (const id of [priv.id, general.id, assigned.id]) expect(all).toContain(id);
      const noPrivate = await ids({ readsGeneral: true, readsPrivateSale: false });
      expect(noPrivate).not.toContain(priv.id);
      expect(noPrivate).toContain(general.id);
      const specialist = await ids({ readsGeneral: false, readsPrivateSale: true });
      expect(specialist).toContain(priv.id);
      expect(specialist).toContain(assigned.id);
      expect(specialist).not.toContain(general.id);
      expect(await ids({ readsGeneral: true, readsPrivateSale: true }, "private_sales")).toContain(
        priv.id,
      );
      expect(await ids({ readsGeneral: true, readsPrivateSale: true }, "assigned_to_me")).toEqual([
        assigned.id,
      ]);
      expect(await ids({ readsGeneral: true, readsPrivateSale: true }, "unassigned")).not.toContain(
        assigned.id,
      );
    });
  });

  it("pages in a stable order with a cursor", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleMarketingEnquiryRepository(tx);
      const created = [];
      for (let i = 0; i < 3; i++) {
        created.push(
          await repo.createInTransaction(tx, { ...base, intent: "press", topic: "press" }),
        );
      }
      const scope = { viewerUserId: STAFF, readsGeneral: true, readsPrivateSale: true };
      const first = await repo.list({ view: "open", scope, intent: "press", limit: 2 });
      expect(first).toHaveLength(3);
      const last = first[1];
      if (!last) throw new Error("expected a second row");
      const next = await repo.list({
        view: "open",
        scope,
        intent: "press",
        limit: 2,
        afterId: last.id,
      });
      const seen = [...first.slice(0, 2), ...next].map((r) => r.id);
      expect(new Set(seen).size).toBe(seen.length);
      for (const row of created) expect(seen).toContain(row.id);
    });
  });

  it("changes an enquiry only at the version it was read at", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleMarketingEnquiryRepository(tx);
      const created = await repo.createInTransaction(tx, {
        ...base,
        intent: "press",
        topic: "press",
      });
      const at = new Date("2026-11-02T12:00:00Z");
      const closed = await repo.updateInTransaction(tx, created.id, 1, {
        status: "closed",
        closeReason: "duplicate",
        assignedToUserId: STAFF,
        closed: { at, byUserId: STAFF },
      });
      expect(closed).toMatchObject({
        version: 2,
        status: "closed",
        closeReason: "duplicate",
        handledAt: at,
        assignedToUserId: STAFF,
      });
      expect(
        await repo.updateInTransaction(tx, created.id, 1, { status: "in_progress" }),
      ).toBeNull();
      const reopened = await repo.updateInTransaction(tx, created.id, 2, {
        status: "in_progress",
        closeReason: null,
        closed: null,
      });
      expect(reopened).toMatchObject({ version: 3, closeReason: null, handledAt: null });
    });
  });

  it("closes an open enquiry once", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleMarketingEnquiryRepository(tx);
      const created = await repo.createInTransaction(tx, {
        ...base,
        intent: "press",
        topic: "press",
      });
      const at = new Date("2026-11-02T12:00:00Z");
      expect(await repo.markHandledInTransaction(tx, created.id, STAFF, at)).toMatchObject({
        status: "closed",
        handledByUserId: STAFF,
      });
      expect(await repo.markHandledInTransaction(tx, created.id, STAFF, at)).toBeNull();
    });
  });

  it("keeps notes and replaces the routing table", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleMarketingEnquiryRepository(tx);
      const notes = new DrizzleEnquiryNoteRepository(tx);
      const routing = new DrizzleEnquiryRoutingRepository(tx);
      const created = await repo.createInTransaction(tx, {
        ...base,
        intent: "press",
        topic: "press",
      });
      await notes.addInTransaction(tx, { enquiryId: created.id, authorUserId: STAFF, body: "One" });
      await notes.addInTransaction(tx, { enquiryId: created.id, authorUserId: STAFF, body: "Two" });
      // Both notes share the transaction's clock, so only their presence is checked here.
      expect((await notes.listForEnquiry(created.id)).map((n) => n.body).sort()).toEqual([
        "One",
        "Two",
      ]);

      await routing.replaceRulesInTransaction(
        tx,
        [
          { departmentSlug: "paintings", assignedToUserId: STAFF },
          { departmentSlug: null, assignedToUserId: STAFF },
        ],
        STAFF,
      );
      expect(await routing.listRules()).toHaveLength(2);
      await routing.replaceRulesInTransaction(
        tx,
        [{ departmentSlug: "prints", assignedToUserId: STAFF }],
        STAFF,
      );
      expect(await routing.listRulesInTransaction(tx)).toEqual([
        { departmentSlug: "prints", assignedToUserId: STAFF },
      ]);
    });
  });
  it("searches name, email, reference and the artist or title, and counts statuses apart from the status filter", async () => {
    await inRollback(async (tx) => {
      const repo = new DrizzleMarketingEnquiryRepository(tx);
      const work = (artist: string, title: string) => ({
        artist,
        title,
        medium: null,
        size: null,
        locationTown: null,
        locationCountry: null,
        priceInMindMinor: null,
        lookingFor: null,
        budgetBand: null,
        timing: null,
        contactPreference: "email" as const,
      });
      const sell = await repo.createInTransaction(tx, {
        ...base,
        name: "Grace Hopper",
        email: "grace@navy.example",
        intent: "private_sale_sell",
        topic: "selling",
        privateSale: work("Bridget Riley", "Fall 100%"),
      });
      const press = await repo.createInTransaction(tx, {
        ...base,
        name: "Alan Turing",
        intent: "general",
        topic: "press",
      });
      await repo.updateInTransaction(tx, press.id, 1, { status: "in_progress" });
      const scope = { viewerUserId: STAFF, readsGeneral: true, readsPrivateSale: true };
      const find = async (search: string, extra = {}) =>
        (await repo.list({ view: "all", scope, limit: 10, search, ...extra })).map((r) => r.id);

      expect(await find("hopper")).toEqual([sell.id]);
      expect(await find("NAVY.EXAMPLE")).toEqual([sell.id]);
      expect(await find(sell.reference.toLowerCase())).toEqual([sell.id]);
      expect(await find("riley")).toEqual([sell.id]);
      expect(await find("fall 100%")).toEqual([sell.id]);
      // `%` and `_` are typed text, not wildcards.
      expect(await find("100%x")).toEqual([]);
      expect(await find("_")).toEqual([]);
      const noPrivate = { ...scope, readsPrivateSale: false };
      expect(
        await repo.list({ view: "all", scope: noPrivate, limit: 10, search: "riley" }),
      ).toEqual([]);

      const sorted = async (sort: "oldest" | "newest") =>
        (await repo.list({ view: "all", scope, limit: 10, search: "example", sort })).map(
          (r) => r.id,
        );
      // Created in one transaction they share a timestamp, so the id breaks the tie.
      const ascending = [sell.id, press.id].sort();
      expect(await sorted("oldest")).toEqual(ascending);
      expect(await sorted("newest")).toEqual([...ascending].reverse());

      const counts = await repo.countByStatus({ view: "all", scope, limit: 10, status: "closed" });
      expect(counts).toMatchObject({ new: 1, in_progress: 1, closed: 0 });
      const searched = await repo.countByStatus({
        view: "all",
        scope,
        limit: 10,
        search: "turing",
      });
      expect(searched).toMatchObject({ new: 0, in_progress: 1 });
      expect(
        await repo.countByStatus({ view: "all", scope: noPrivate, limit: 10, search: "riley" }),
      ).toMatchObject({ new: 0, in_progress: 0 });
    });
  });
});
