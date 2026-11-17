import { randomUUID } from "node:crypto";
import { type Database, createDbFromPool } from "@auction/db";
import { artworkConsignorLink, shopAdminAudit } from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleConsignorAgreementStore,
} from "@auction/persistence/repositories";
import { ShopDomainError } from "@auction/shop-domain";
import { and, eq, sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDrizzleArtworkConsignorReads,
  createDrizzleArtworkConsignorWritesFor,
} from "../../infrastructure/drizzle-artwork-consignor.js";
import { createDrizzleShopUnitOfWork } from "../../infrastructure/drizzle-shop-transaction-effects.js";
import { integrationSuffix, uniqueStockCode } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import type { ShopUnitOfWorkFactory } from "../ports/shop-unit-of-work.js";
import { createArtworkConsignorService } from "./artwork-consignor.service.js";

const NOW = new Date("2026-11-17T09:00:00.000Z");
const storeOn = (session: Database) => new DrizzleConsignorAgreementStore(session);
const key = () => `idem-${integrationSuffix("k")}`;

/**
 * Runs as `shop_app`, the role shop-api uses, so the grants from 0407 are shown to be enough for
 * the consignor link, the audit row and the idempotency record together.
 */
describe.skipIf(!hasShopIntegrationDb)("artwork consignor service (Postgres)", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  let clock = NOW;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  const owner = () => createDbFromPool(ownerPool);

  function service(uow?: ShopUnitOfWorkFactory) {
    const db = createShopDb(shopPool);
    return createArtworkConsignorService({
      uow: uow ?? createDrizzleShopUnitOfWork(db, "off"),
      reads: createDrizzleArtworkConsignorReads(db, storeOn),
      writesFor: createDrizzleArtworkConsignorWritesFor(storeOn),
      staffNames: { namesFor: async (ids) => new Map(ids.map((id) => [id, `Name of ${id}`])) },
      clock: () => clock,
    });
  }

  /** The real unit of work, failing after the audit row was written. */
  function failingAfterAudit(): ShopUnitOfWorkFactory {
    const real = createDrizzleShopUnitOfWork(createShopDb(shopPool), "off");
    return {
      run: (work) =>
        real.run(async (tx) => {
          await work(tx);
          throw new Error("commit refused");
        }),
    };
  }

  async function client(name = "Ivo Marren"): Promise<string> {
    const id = randomUUID();
    await owner().execute(
      sql`INSERT INTO shop_party (id, display_name, kind) VALUES (${id}, ${name}, 'person')`,
    );
    return id;
  }

  async function artwork(print?: { sourceOriginalId: string }): Promise<string> {
    const created = await new DrizzleArtworkRegisterRepository(owner()).create(
      {
        zohoProductId: `zoho-${integrationSuffix("c")}`,
        stockCode: uniqueStockCode(print ? "print" : "original"),
        kind: print ? "print" : "original",
        sourceOriginalId: print?.sourceOriginalId ?? null,
        title: "Harbour at dusk",
        artist: { zohoArtistId: "80", name: "Ada Rowe", code: "CSG" },
        medium: null,
        dimensions: null,
        year: null,
        imageRefs: [],
        catalogueStatus: "Available",
      },
      "zoho",
      NOW,
    );
    if (!created.ok) throw new Error(created.reason);
    return created.entry.id;
  }

  async function agreement(partyId: string, status: "current" | "retired" = "current") {
    const added = await storeOn(owner()).addAgreement({
      partyId,
      terms: {
        places: ["lax_bid", "lax_art"],
        startsOn: "2026-03-03",
        endsOn: "2027-03-02",
        lowestPricePence: null,
        commissionBasisPoints: null,
        signedFileKey: `private/consignor-agreements/${partyId}/${randomUUID()}.pdf`,
        note: null,
      },
      actor: "staff:it",
      now: NOW,
    });
    if (!added.ok) throw new Error(added.reason);
    if (status === "retired") {
      await storeOn(owner()).retireAgreement({
        agreementId: added.agreement.agreementId,
        expectedVersion: 1,
        actor: "staff:it",
        now: NOW,
      });
    }
    return added.agreement;
  }

  const audits = (registerId: string) =>
    owner()
      .select()
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.targetId, registerId),
          eq(shopAdminAudit.action, "artwork_consignor.set"),
        ),
      );

  const links = (registerId: string) =>
    owner()
      .select()
      .from(artworkConsignorLink)
      .where(eq(artworkConsignorLink.registerId, registerId));

  /** The audit row's JSON columns, which are stored as text. */
  const json = (value: unknown) =>
    typeof value === "string" ? (JSON.parse(value) as Record<string, unknown>) : value;

  it("reads no consignor for a new work, and nothing for an unknown one", async () => {
    const registerId = await artwork();
    expect(await service().get(registerId)).toEqual({
      registerId,
      current: null,
      history: [],
      moreHistory: false,
      agreements: [],
    });
    expect(await service().get(randomUUID())).toBeNull();
  });

  it("sets a client first without a reason, names them and lists their current agreements", async () => {
    const registerId = await artwork();
    const partyId = await client("Ana Ruiz");
    const kept = await agreement(partyId);
    await agreement(partyId, "retired");
    const set = await service().set({
      actorSubjectId: "admin-1",
      idempotencyKey: key(),
      registerId,
      consignor: { kind: "client", partyId },
      reason: "  ",
      expectedCurrentId: null,
    });
    expect(set.current).toMatchObject({
      consignor: { kind: "client", partyId, displayName: "Ana Ruiz" },
      changeReason: null,
      setAt: NOW.toISOString(),
      setByName: "Name of admin-1",
    });
    // Where and when the agreement applies; its terms, signed file and note stay on the client.
    expect(set.agreements).toEqual([
      {
        id: kept.id,
        status: "current",
        places: ["lax_bid", "lax_art"],
        startsOn: "2026-03-03",
        endsOn: "2027-03-02",
        createdAt: NOW.toISOString(),
      },
    ]);
    const [audit] = await audits(registerId);
    expect(audit).toMatchObject({
      actorSubjectId: "admin-1",
      capability: "consignor_agreement.manage",
      targetType: "artwork_register",
    });
    expect(audit?.beforeJson).toBeNull();
    expect(json(audit?.afterJson)).toEqual({ consignor: "client", partyId, withReason: false });
  });

  it("changes to LAX only with a reason, keeping the history newest first", async () => {
    const registerId = await artwork();
    const partyId = await client();
    const first = await service().set({
      actorSubjectId: "admin-1",
      idempotencyKey: key(),
      registerId,
      consignor: { kind: "client", partyId },
      expectedCurrentId: null,
    });
    clock = new Date(NOW.getTime() + 60_000);
    await expect(
      service().set({
        actorSubjectId: "admin-2",
        idempotencyKey: key(),
        registerId,
        consignor: { kind: "lax" },
        expectedCurrentId: first.current?.id ?? null,
      }),
    ).rejects.toMatchObject({ statusCode: 400, issues: [{ field: "reason" }] });
    const changed = await service().set({
      actorSubjectId: "admin-2",
      idempotencyKey: key(),
      registerId,
      consignor: { kind: "lax" },
      reason: "Bought outright",
      expectedCurrentId: first.current?.id ?? null,
    });
    clock = NOW;
    expect(changed.current).toMatchObject({
      consignor: { kind: "lax" },
      changeReason: "Bought outright",
    });
    expect(changed.history.map((item) => item.consignor.kind)).toEqual(["lax", "client"]);
    expect(changed.agreements).toEqual([]);
    const rows = await audits(registerId);
    const second = rows.find((row) => row.actorSubjectId === "admin-2");
    expect(json(second?.beforeJson)).toEqual({ consignor: "client", partyId, withReason: false });
    expect(json(second?.afterJson)).toEqual({ consignor: "lax", partyId: null, withReason: true });
    // The reason's words stay out of the audit row.
    expect(JSON.stringify(second?.afterJson)).not.toContain("Bought outright");
  });

  it("refuses a change against a consignor someone changed since, writing nothing", async () => {
    const registerId = await artwork();
    const first = await service().set({
      actorSubjectId: "admin-1",
      idempotencyKey: key(),
      registerId,
      consignor: { kind: "lax" },
      expectedCurrentId: null,
    });
    const late = await service()
      .set({
        actorSubjectId: "admin-2",
        idempotencyKey: key(),
        registerId,
        consignor: { kind: "client", partyId: await client() },
        reason: "Consigned",
        expectedCurrentId: null,
      })
      .catch((error: unknown) => error);
    expect(late).toMatchObject({ statusCode: 409, currentVersion: first.current?.id });
    expect(await links(registerId)).toHaveLength(1);
    expect(await audits(registerId)).toHaveLength(1);
  });

  it("records nothing and audits nothing when the consignor is already so", async () => {
    const registerId = await artwork();
    const command = () => ({
      actorSubjectId: "admin-1",
      idempotencyKey: key(),
      registerId,
      consignor: { kind: "lax" } as const,
    });
    await service().set(command());
    const again = await service().set(command());
    expect(again.history).toHaveLength(1);
    expect(await audits(registerId)).toHaveLength(1);
  });

  it("answers a retry with the same key once, and leaves nothing when the commit fails", async () => {
    const registerId = await artwork();
    const command = {
      actorSubjectId: "admin-1",
      idempotencyKey: key(),
      registerId,
      consignor: { kind: "lax" } as const,
      expectedCurrentId: null,
    };
    await expect(service(failingAfterAudit()).set(command)).rejects.toThrow("commit refused");
    expect(await links(registerId)).toEqual([]);
    expect(await audits(registerId)).toEqual([]);
    const first = await service().set(command);
    const retry = await service().set(command);
    expect(retry).toEqual(first);
    expect(await links(registerId)).toHaveLength(1);
  });

  it("refuses an unknown client beside the client field, and an unknown artwork with 404", async () => {
    const registerId = await artwork();
    await expect(
      service().set({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        registerId,
        consignor: { kind: "client", partyId: randomUUID() },
      }),
    ).rejects.toMatchObject({ statusCode: 400, issues: [{ field: "client" }] });
    await expect(
      service().set({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        registerId: randomUUID(),
        consignor: { kind: "lax" },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses a reason past 500 characters before taking any lock", async () => {
    const registerId = await artwork();
    await expect(
      service().set({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        registerId,
        consignor: { kind: "lax" },
        reason: "x".repeat(501),
      }),
    ).rejects.toMatchObject({ statusCode: 400, issues: [{ field: "reason" }] });
    expect(await links(registerId)).toEqual([]);
  });

  it("refuses a print, which has no consignor: 404 to read, 409 to set, writing nothing", async () => {
    const original = await artwork();
    const print = await artwork({ sourceOriginalId: original });
    await expect(service().get(print)).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      service().set({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        registerId: print,
        consignor: { kind: "lax" },
      }),
    ).rejects.toBeInstanceOf(ShopDomainError);
    expect(await links(print)).toEqual([]);
    expect(await audits(print)).toEqual([]);
  });
});
