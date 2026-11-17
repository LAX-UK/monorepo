import { randomUUID } from "node:crypto";
import type { AgreementTerms } from "@auction/artwork-register-contracts";
import { type Database, createDb } from "@auction/db";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { DrizzleConsignorAgreementStore } from "./index.js";

const url = process.env.DATABASE_URL;
const shopUrl = process.env.DATABASE_URL_SHOP;
const db = url ? createDb(url) : (null as never);

const T0 = new Date("2026-11-17T09:00:00.000Z");
const T1 = new Date("2026-11-17T10:00:00.000Z");
const T2 = new Date("2026-11-17T11:00:00.000Z");
const STAFF = "staff:s1";

const TERMS: AgreementTerms = {
  places: ["lax_bid", "lax_art"],
  startsOn: "2026-03-03",
  endsOn: "2027-03-02",
  lowestPricePence: 200_000,
  commissionBasisPoints: 2500,
  signedFileKey: "consignor-agreements/one/signed.pdf",
  note: "Signed in the gallery",
};

describe.skipIf(!url)("consignor agreements (Postgres)", { timeout: 30_000 }, () => {
  const store = new DrizzleConsignorAgreementStore(db);
  const parties: string[] = [];
  const artworks: string[] = [];

  /**
   * Removes only what these tests made. The tables refuse deletes for every role, so the owner
   * turns the triggers off for the clean-up, as an operator exporting before a rollback would.
   */
  async function clear() {
    if (artworks.length > 0) {
      await db.execute(
        sql`ALTER TABLE artwork_consignor_link DISABLE TRIGGER artwork_consignor_link_append_only`,
      );
      await db.execute(
        sql`DELETE FROM artwork_consignor_link WHERE register_id IN (${sql.join(
          artworks.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
      );
      await db.execute(
        sql`ALTER TABLE artwork_consignor_link ENABLE TRIGGER artwork_consignor_link_append_only`,
      );
      await db.execute(
        sql`DELETE FROM artwork_register WHERE id IN (${sql.join(
          artworks.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
      );
      artworks.length = 0;
    }
    if (parties.length > 0) {
      const ids = sql.join(
        parties.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      await db.execute(
        sql`ALTER TABLE consignor_agreement DISABLE TRIGGER consignor_agreement_frozen`,
      );
      // Newest version first: each later version holds a key on the one it replaced.
      await db.execute(
        sql`DELETE FROM consignor_agreement WHERE party_id IN (${ids}) AND replaces_id IS NOT NULL`,
      );
      await db.execute(sql`DELETE FROM consignor_agreement WHERE party_id IN (${ids})`);
      await db.execute(
        sql`ALTER TABLE consignor_agreement ENABLE TRIGGER consignor_agreement_frozen`,
      );
      await db.execute(sql`DELETE FROM shop_party WHERE id IN (${ids})`);
      parties.length = 0;
    }
  }

  afterEach(async () => {
    await clear();
  });

  afterAll(async () => {
    await clear();
  });

  async function client(kind: "person" | "artist" | "lax" = "person"): Promise<string> {
    const id = randomUUID();
    await db.execute(
      sql`INSERT INTO shop_party (id, display_name, kind) VALUES (${id}, 'Consignor', ${kind})`,
    );
    parties.push(id);
    return id;
  }

  async function artwork(): Promise<string> {
    const n = String(Math.floor(Math.random() * 9000) + 1000);
    const rows = await db.execute<{ id: string }>(
      sql`INSERT INTO artwork_register (zoho_product_id, stock_code, kind, title, artist_name, artist_code)
          VALUES (${`csg-${randomUUID()}`}, ${`LAX-ORI-AAA-CSG-26-${n}`}, 'original', 'Work', 'Artist', 'AAA')
          RETURNING id`,
    );
    const id = rows.rows[0]?.id as string;
    artworks.push(id);
    return id;
  }

  async function add(partyId: string, terms: Partial<AgreementTerms> = {}) {
    const result = await store.addAgreement({
      partyId,
      terms: { ...TERMS, ...terms },
      actor: STAFF,
      now: T0,
    });
    if (!result.ok) throw new Error(result.reason);
    return result.agreement;
  }

  describe("agreements", () => {
    it("adds a first version whose id is the agreement's id", async () => {
      const partyId = await client();
      const added = await add(partyId);
      expect(added).toMatchObject({
        agreementId: added.id,
        version: 1,
        partyId,
        places: ["lax_bid", "lax_art"],
        startsOn: "2026-03-03",
        endsOn: "2027-03-02",
        lowestPricePence: 200_000,
        commissionBasisPoints: 2500,
        status: "current",
        replacesId: null,
        createdBy: STAFF,
      });
      expect(await store.findAgreementVersion(added.id)).toEqual(added);
    });

    it("refuses a party that does not exist, or LAX itself", async () => {
      const missing = await store.addAgreement({
        partyId: randomUUID(),
        terms: TERMS,
        actor: STAFF,
        now: T0,
      });
      expect(missing).toEqual({ ok: false, reason: "party_not_found" });
      // There is at most one LAX party; it is made here when the database has none yet.
      const lax = await db.execute<{ id: string }>(
        sql`SELECT id FROM shop_party WHERE kind = 'lax' LIMIT 1`,
      );
      let laxId = lax.rows[0]?.id;
      if (!laxId) laxId = await client("lax");
      expect(
        await store.addAgreement({ partyId: laxId, terms: TERMS, actor: STAFF, now: T0 }),
      ).toEqual({ ok: false, reason: "party_not_found" });
    });

    it("replaces a version with the next, keeping the old one unchanged", async () => {
      const partyId = await client();
      const first = await add(partyId);
      const replaced = await store.replaceAgreement({
        agreementId: first.agreementId,
        expectedVersion: 1,
        terms: { ...TERMS, lowestPricePence: 250_000, places: ["private_sale"] },
        actor: "staff:s2",
        now: T1,
      });
      if (!replaced.ok) throw new Error(replaced.reason);
      expect(replaced.agreement).toMatchObject({
        agreementId: first.id,
        version: 2,
        replacesId: first.id,
        lowestPricePence: 250_000,
        places: ["private_sale"],
        status: "current",
        createdBy: "staff:s2",
      });
      const versions = await store.listVersions(first.agreementId);
      expect(versions.map((v) => [v.version, v.status])).toEqual([
        [1, "replaced"],
        [2, "current"],
      ]);
      // The old version's terms are as they were signed.
      expect(versions[0]).toEqual({ ...first, status: "replaced", replacedAt: T1 });
    });

    it("refuses a stale version, an unknown agreement and a retired one", async () => {
      const partyId = await client();
      const first = await add(partyId);
      const replace = (expectedVersion: number, agreementId = first.agreementId) =>
        store.replaceAgreement({
          agreementId,
          expectedVersion,
          terms: TERMS,
          actor: STAFF,
          now: T1,
        });
      expect((await replace(1)).ok).toBe(true);
      expect(await replace(1)).toEqual({ ok: false, reason: "stale" });
      expect(await replace(1, randomUUID())).toEqual({ ok: false, reason: "not_found" });
      const retired = await store.retireAgreement({
        agreementId: first.agreementId,
        expectedVersion: 2,
        actor: STAFF,
        now: T2,
      });
      expect(retired).toMatchObject({
        ok: true,
        agreement: { version: 2, status: "retired", retiredAt: T2, retiredBy: STAFF },
      });
      expect(await replace(2)).toEqual({ ok: false, reason: "not_current" });
      expect(
        await store.retireAgreement({
          agreementId: first.agreementId,
          expectedVersion: 2,
          actor: STAFF,
          now: T2,
        }),
      ).toEqual({ ok: false, reason: "not_current" });
    });

    it("lets one of two replaces of the same version win", async () => {
      const partyId = await client();
      const first = await add(partyId);
      const results = await Promise.all(
        [1, 2].map((n) =>
          store.replaceAgreement({
            agreementId: first.agreementId,
            expectedVersion: 1,
            terms: { ...TERMS, lowestPricePence: n * 100_000 },
            actor: STAFF,
            now: T1,
          }),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "stale" }]);
      expect((await store.listVersions(first.agreementId)).map((v) => v.status)).toEqual([
        "replaced",
        "current",
      ]);
    });

    it("lists a client's current agreements first, and replaced versions only when asked", async () => {
      const partyId = await client();
      const other = await client();
      const old = await add(partyId, { places: ["private_sale"] });
      const kept = await add(partyId);
      await add(other);
      await store.retireAgreement({
        agreementId: old.agreementId,
        expectedVersion: 1,
        actor: STAFF,
        now: T1,
      });
      const replaced = await store.replaceAgreement({
        agreementId: kept.agreementId,
        expectedVersion: 1,
        terms: TERMS,
        actor: STAFF,
        now: T2,
      });
      if (!replaced.ok) throw new Error(replaced.reason);
      expect(
        (await store.listAgreements(partyId)).map((a) => [a.agreementId, a.version, a.status]),
      ).toEqual([
        [kept.agreementId, 2, "current"],
        [old.agreementId, 1, "retired"],
      ]);
      expect(await store.listAgreements(partyId, { includeReplaced: true })).toHaveLength(3);
    });
  });

  describe("the consignor of an original", () => {
    it("sets a client, then changes to LAX with a reason, keeping the history", async () => {
      const partyId = await client();
      const registerId = await artwork();
      const first = await store.setConsignor({
        registerId,
        consignor: { kind: "client", partyId },
        reason: null,
        actor: STAFF,
        now: T0,
      });
      expect(first).toMatchObject({
        ok: true,
        changed: true,
        link: { consignor: { kind: "client", partyId }, changeReason: null, setAt: T0 },
        previous: null,
      });
      expect(
        await store.setConsignor({
          registerId,
          consignor: { kind: "lax" },
          reason: " ",
          actor: STAFF,
          now: T1,
        }),
      ).toEqual({ ok: false, reason: "reason_required" });
      const changed = await store.setConsignor({
        registerId,
        consignor: { kind: "lax" },
        reason: "Bought outright",
        actor: STAFF,
        now: T1,
      });
      expect(changed).toMatchObject({
        ok: true,
        changed: true,
        previous: { consignor: { kind: "client", partyId } },
      });
      expect((await store.currentConsignors([registerId])).get(registerId)?.consignor).toEqual({
        kind: "lax",
      });
      expect(
        (await store.listConsignorChanges(registerId, 10)).map((c) => [
          c.consignor.kind,
          c.changeReason,
        ]),
      ).toEqual([
        ["lax", "Bought outright"],
        ["client", null],
      ]);
    });

    it("records nothing when the consignor is already so", async () => {
      const partyId = await client();
      const registerId = await artwork();
      const set = () =>
        store.setConsignor({
          registerId,
          consignor: { kind: "client", partyId },
          reason: null,
          actor: STAFF,
          now: T0,
        });
      await set();
      expect(await set()).toMatchObject({ ok: true, changed: false });
      expect(await store.listConsignorChanges(registerId, 10)).toHaveLength(1);
    });

    it("stamps a change after the previous one when the clock repeats", async () => {
      const registerId = await artwork();
      const partyId = await client();
      await store.setConsignor({
        registerId,
        consignor: { kind: "lax" },
        reason: null,
        actor: STAFF,
        now: T1,
      });
      const again = await store.setConsignor({
        registerId,
        consignor: { kind: "client", partyId },
        reason: "Consigned after all",
        actor: STAFF,
        now: T0,
      });
      if (!again.ok) throw new Error(again.reason);
      expect(again.link.setAt.getTime()).toBe(T1.getTime() + 1);
      expect((await store.currentConsignors([registerId])).get(registerId)?.consignor).toEqual({
        kind: "client",
        partyId,
      });
    });

    it("refuses a change made against a consignor someone has changed since", async () => {
      const registerId = await artwork();
      const partyId = await client();
      const first = await store.setConsignor({
        registerId,
        consignor: { kind: "lax" },
        reason: null,
        expectedCurrentId: null,
        actor: STAFF,
        now: T0,
      });
      if (!first.ok) throw new Error(first.reason);
      // A second person read "not set" before the first change committed.
      const late = await store.setConsignor({
        registerId,
        consignor: { kind: "client", partyId },
        reason: null,
        expectedCurrentId: null,
        actor: STAFF,
        now: T1,
      });
      expect(late).toMatchObject({ ok: false, reason: "stale", current: { id: first.link.id } });
      const onTime = await store.setConsignor({
        registerId,
        consignor: { kind: "client", partyId },
        reason: "Consigned by the collector",
        expectedCurrentId: first.link.id,
        actor: STAFF,
        now: T1,
      });
      expect(onTime).toMatchObject({ ok: true, changed: true });
      expect(await store.listConsignorChanges(registerId, 10)).toHaveLength(2);
    });

    it("refuses an unknown artwork or client", async () => {
      const registerId = await artwork();
      expect(
        await store.setConsignor({
          registerId: randomUUID(),
          consignor: { kind: "lax" },
          reason: null,
          actor: STAFF,
          now: T0,
        }),
      ).toEqual({ ok: false, reason: "artwork_not_found" });
      expect(
        await store.setConsignor({
          registerId,
          consignor: { kind: "client", partyId: randomUUID() },
          reason: null,
          actor: STAFF,
          now: T0,
        }),
      ).toEqual({ ok: false, reason: "party_not_found" });
    });
  });

  describe("cover", () => {
    it("reads no consignor, LAX owns it, covered and not covered", async () => {
      const partyId = await client();
      const registerId = await artwork();
      const cover = (place: "lax_bid" | "lax_art" | "private_sale", day = "2026-11-17") =>
        store.assessCover({ registerId, place, day });

      expect(await cover("lax_bid")).toEqual({ kind: "no_consignor" });

      await store.setConsignor({
        registerId,
        consignor: { kind: "client", partyId },
        reason: null,
        actor: STAFF,
        now: T0,
      });
      expect(await cover("lax_bid")).toEqual({ kind: "not_covered", partyId });

      const signed = await add(partyId);
      expect(await cover("lax_bid")).toEqual({ kind: "covered", partyId, agreement: signed });
      expect(await cover("private_sale")).toEqual({ kind: "not_covered", partyId });
      expect(await cover("lax_bid", "2027-03-03")).toEqual({ kind: "not_covered", partyId });

      await store.retireAgreement({
        agreementId: signed.agreementId,
        expectedVersion: 1,
        actor: STAFF,
        now: T1,
      });
      expect(await cover("lax_bid")).toEqual({ kind: "not_covered", partyId });

      await store.setConsignor({
        registerId,
        consignor: { kind: "lax" },
        reason: "Bought outright",
        actor: STAFF,
        now: T2,
      });
      expect(await cover("lax_bid")).toEqual({ kind: "lax_owns" });
    });
  });

  describe.skipIf(!shopUrl)("as LAX Admin's database role", () => {
    const shopDb = shopUrl ? createDb(shopUrl) : (null as never);
    const shopStore = new DrizzleConsignorAgreementStore(shopDb as Database);

    it("adds, replaces and retires agreements and sets a consignor with shop_app's grants", async () => {
      const partyId = await client();
      const registerId = await artwork();
      const added = await shopStore.addAgreement({ partyId, terms: TERMS, actor: STAFF, now: T0 });
      if (!added.ok) throw new Error(added.reason);
      const replaced = await shopStore.replaceAgreement({
        agreementId: added.agreement.agreementId,
        expectedVersion: 1,
        terms: TERMS,
        actor: STAFF,
        now: T1,
      });
      expect(replaced.ok).toBe(true);
      const retired = await shopStore.retireAgreement({
        agreementId: added.agreement.agreementId,
        expectedVersion: 2,
        actor: STAFF,
        now: T2,
      });
      expect(retired.ok).toBe(true);
      const set = await shopStore.setConsignor({
        registerId,
        consignor: { kind: "client", partyId },
        reason: null,
        actor: STAFF,
        now: T0,
      });
      expect(set).toMatchObject({ ok: true, changed: true });
      expect(
        await shopStore.assessCover({ registerId, place: "lax_bid", day: "2026-11-17" }),
      ).toEqual({ kind: "not_covered", partyId });
    });

    it("cannot edit an agreement's terms or delete one", async () => {
      const partyId = await client();
      const added = await add(partyId);
      await expect(
        shopDb.execute(
          sql`UPDATE consignor_agreement SET lowest_price_pence = 1 WHERE id = ${added.id}`,
        ),
      ).rejects.toMatchObject({ cause: { code: "42501" } });
      await expect(
        shopDb.execute(sql`DELETE FROM consignor_agreement WHERE id = ${added.id}`),
      ).rejects.toMatchObject({ cause: { code: "42501" } });
    });
  });
});
