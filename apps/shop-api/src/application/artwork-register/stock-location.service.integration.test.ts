import { type Database, createDbFromPool } from "@auction/db";
import {
  artworkLocation,
  artworkLocationMove,
  domainEvent,
  shopAdminAudit,
} from "@auction/db/schema";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleStockLocationStore,
} from "@auction/persistence/repositories";
import { and, eq, inArray } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { createDrizzleShopUnitOfWork } from "../../infrastructure/drizzle-shop-transaction-effects.js";
import {
  createDrizzleStockLocationReads,
  createDrizzleStockLocationWritesFor,
} from "../../infrastructure/drizzle-stock-location.js";
import { integrationSuffix, uniqueStockCode } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import type { ShopUnitOfWorkFactory } from "../ports/shop-unit-of-work.js";
import type { StaffNameReader } from "../ports/staff-name.reader.js";
import { createStockLocationService } from "./stock-location.service.js";

const NOW = new Date("2026-11-17T09:00:00.000Z");
const storeOn = (session: Database) => new DrizzleStockLocationStore(session);
const key = () => `idem-${integrationSuffix("k")}`;
/** Staff names are read elsewhere; here every mover is named after their id. */
const staffNames: StaffNameReader = {
  namesFor: async (subjects) => new Map(subjects.map((subject) => [subject, `Name of ${subject}`])),
};

/**
 * Runs as `shop_app`, the role shop-api uses, so the grants from #1518 are shown to be enough
 * for the location, move, history, event, audit and idempotency writes together.
 */
describe.skipIf(!hasShopIntegrationDb)("stock location service (Postgres)", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

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
    return createStockLocationService({
      uow: uow ?? createDrizzleShopUnitOfWork(db, "off"),
      reads: createDrizzleStockLocationReads(db, storeOn),
      writesFor: createDrizzleStockLocationWritesFor(storeOn),
      staffNames,
      clock: () => NOW,
    });
  }

  /**
   * The real unit of work, with one effect replaced: what a failure after the audit row was
   * written looks like.
   */
  function failingAfterAudit(): ShopUnitOfWorkFactory {
    const real = createDrizzleShopUnitOfWork(createShopDb(shopPool), "off");
    return {
      run: (fn) =>
        real.run((tx) =>
          fn({
            ...tx,
            commands: {
              ...tx.commands,
              complete: async () => {
                throw new Error("failed after the audit row");
              },
            },
          }),
        ),
    };
  }

  /** The audit writer refuses: the change it would describe must not commit either. */
  function failingAudit(): ShopUnitOfWorkFactory {
    const real = createDrizzleShopUnitOfWork(createShopDb(shopPool), "off");
    return {
      run: (fn) =>
        real.run((tx) =>
          fn({
            ...tx,
            audit: {
              append: async () => {
                throw new Error("audit unavailable");
              },
            },
          }),
        ),
    };
  }

  async function artwork() {
    const register = new DrizzleArtworkRegisterRepository(owner());
    const suffix = integrationSuffix("r");
    const created = await register.create(
      {
        zohoProductId: `zoho-loc-${suffix}`,
        stockCode: uniqueStockCode("original"),
        kind: "original",
        sourceOriginalId: null,
        title: "Salt marsh, dusk",
        artist: {
          zohoArtistId: "91",
          name: "Ivo Marren",
          code: `M${suffix.slice(-5).toUpperCase()}`,
        },
        medium: "Oil on board",
        dimensions: "40 × 50 cm",
        year: 2025,
        imageRefs: [],
        catalogueStatus: "Available",
      },
      "zoho",
      NOW,
    );
    if (!created.ok) throw new Error(`register entry: ${created.reason}`);
    return created.entry.id;
  }

  async function addLocation(name = `Store room ${integrationSuffix("n")}`) {
    const result = await service().addLocation({
      actorSubjectId: "admin-1",
      idempotencyKey: key(),
      name,
      note: null,
    });
    return result.location;
  }

  async function auditRows(targetIds: string[], action?: string) {
    return owner()
      .select()
      .from(shopAdminAudit)
      .where(
        and(
          inArray(shopAdminAudit.targetId, targetIds),
          ...(action ? [eq(shopAdminAudit.action, action)] : []),
        ),
      );
  }

  async function moves(registerIds: string[]) {
    return owner()
      .select()
      .from(artworkLocationMove)
      .where(inArray(artworkLocationMove.registerId, registerIds));
  }

  async function locationEvents(registerIds: string[]) {
    return owner()
      .select()
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.eventType, "artwork_register.location_changed"),
          inArray(domainEvent.aggregateId, registerIds),
        ),
      );
  }

  describe("moves", () => {
    it("writes one audit row per artwork moved, with the move, its history and its event", async () => {
      const [a, b] = [await artwork(), await artwork()];
      const store = await addLocation();
      const result = await service().moveArtworks({
        actorSubjectId: "gallery-1",
        idempotencyKey: key(),
        request: { registerIds: [a, b], locationId: store.id, note: "Winter hang" },
      });
      expect(result.moved.map((m) => m.registerId).sort()).toEqual([a, b].sort());

      const audit = await auditRows([a, b], "artwork_location.move");
      expect(audit).toHaveLength(2);
      for (const row of audit) {
        expect(row.capability).toBe("artwork_location.move");
        expect(row.targetType).toBe("artwork_register");
        expect(row.actorSubjectId).toBe("gallery-1");
        expect(JSON.parse(row.beforeJson ?? "{}")).toEqual({ locationId: null });
        expect(JSON.parse(row.afterJson ?? "{}")).toEqual({
          locationId: store.id,
          withNote: true,
        });
      }
      expect(await moves([a, b])).toHaveLength(2);
      expect(await locationEvents([a, b])).toHaveLength(2);
    });

    it("audits nothing for an artwork already at the location", async () => {
      const a = await artwork();
      const store = await addLocation();
      const request = { registerIds: [a], locationId: store.id };
      await service().moveArtworks({ actorSubjectId: "ops-1", idempotencyKey: key(), request });
      const again = await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey: key(),
        request,
      });
      expect(again.unchanged).toEqual([a]);
      expect(await auditRows([a], "artwork_location.move")).toHaveLength(1);
    });

    it("leaves no move, history, event or audit row when the unit of work fails after the audit", async () => {
      const a = await artwork();
      const store = await addLocation();
      await expect(
        service(failingAfterAudit()).moveArtworks({
          actorSubjectId: "ops-1",
          idempotencyKey: key(),
          request: { registerIds: [a], locationId: store.id },
        }),
      ).rejects.toThrow("failed after the audit row");
      expect(await auditRows([a])).toHaveLength(0);
      expect(await moves([a])).toHaveLength(0);
      expect(await locationEvents([a])).toHaveLength(0);
      expect((await service().artworkLocation(a))?.current).toBeNull();
    });

    it("does not record the move when the audit row cannot be written", async () => {
      const a = await artwork();
      const store = await addLocation();
      await expect(
        service(failingAudit()).moveArtworks({
          actorSubjectId: "ops-1",
          idempotencyKey: key(),
          request: { registerIds: [a], locationId: store.id },
        }),
      ).rejects.toThrow("audit unavailable");
      expect(await moves([a])).toHaveLength(0);
      expect(await locationEvents([a])).toHaveLength(0);
    });

    it("answers a retry with the same key from the first result, moving and auditing once", async () => {
      const a = await artwork();
      const [first, second] = [await addLocation(), await addLocation()];
      const idempotencyKey = key();
      const request = { registerIds: [a], locationId: first.id };
      const once = await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey,
        request,
      });
      // Someone else moves it on in between; the retry must not move it back.
      await service().moveArtworks({
        actorSubjectId: "ops-2",
        idempotencyKey: key(),
        request: { registerIds: [a], locationId: second.id },
      });
      const replay = await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey,
        request,
      });
      expect(replay).toEqual(once);
      expect(await moves([a])).toHaveLength(2);
      expect(await auditRows([a], "artwork_location.move")).toHaveLength(2);
      expect((await service().artworkLocation(a))?.current?.location.id).toBe(second.id);
    });

    it("refuses the same key with a different body", async () => {
      const a = await artwork();
      const [first, second] = [await addLocation(), await addLocation()];
      const idempotencyKey = key();
      await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey,
        request: { registerIds: [a], locationId: first.id },
      });
      await expect(
        service().moveArtworks({
          actorSubjectId: "ops-1",
          idempotencyKey,
          request: { registerIds: [a], locationId: second.id },
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(await moves([a])).toHaveLength(1);
    });

    it("refuses the same key with a different note, recording only the first move", async () => {
      const a = await artwork();
      const store = await addLocation();
      const idempotencyKey = key();
      await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey,
        request: { registerIds: [a], locationId: store.id, note: "For the winter hang" },
      });
      await expect(
        service().moveArtworks({
          actorSubjectId: "ops-1",
          idempotencyKey,
          request: { registerIds: [a], locationId: store.id, note: "For packing" },
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      const recorded = await moves([a]);
      expect(recorded.map((row) => row.note)).toEqual(["For the winter hang"]);
    });

    it("replays the same key with the ids reordered and repeated, auditing once", async () => {
      const [a, b] = [await artwork(), await artwork()];
      const store = await addLocation();
      const idempotencyKey = key();
      const once = await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey,
        request: { registerIds: [a, b], locationId: store.id },
      });
      const replay = await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey,
        request: { registerIds: [b, a, b], locationId: store.id },
      });
      expect(replay).toEqual(once);
      expect(await moves([a, b])).toHaveLength(2);
      expect(await auditRows([a, b], "artwork_location.move")).toHaveLength(2);
      expect(await locationEvents([a, b])).toHaveLength(2);
    });

    it("refuses a retired location and audits nothing", async () => {
      const a = await artwork();
      const store = await addLocation();
      await service().retireLocation({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        locationId: store.id,
        expectedVersion: store.version,
      });
      const refused = service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey: key(),
        request: { registerIds: [a], locationId: store.id },
      });
      await expect(refused).rejects.toBeInstanceOf(ShopApiError);
      await expect(refused).rejects.toMatchObject({ statusCode: 409 });
      expect(await auditRows([a])).toHaveLength(0);
      expect(await moves([a])).toHaveLength(0);
    });

    it("reads the current location and the history, newest first", async () => {
      const a = await artwork();
      const [first, second] = [
        await addLocation(`Framer ${integrationSuffix("f")}`),
        await addLocation(),
      ];
      const later = new Date(NOW.getTime() + 60_000);
      await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey: key(),
        request: { registerIds: [a], locationId: first.id },
      });
      await createStockLocationService({
        uow: createDrizzleShopUnitOfWork(createShopDb(shopPool), "off"),
        reads: createDrizzleStockLocationReads(createShopDb(shopPool), storeOn),
        writesFor: createDrizzleStockLocationWritesFor(storeOn),
        staffNames,
        clock: () => later,
      }).moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey: key(),
        request: { registerIds: [a], locationId: second.id, note: "For packing" },
      });
      const read = await service().artworkLocation(a);
      expect(read?.label).toBe(second.name);
      // The current location is the newest move of the same read.
      expect(read?.current).toEqual({
        location: { id: second.id, name: second.name, status: "active", label: second.name },
        movedAt: later.toISOString(),
        movedBy: "staff:ops-1",
        movedByName: "Name of ops-1",
      });
      expect(read?.moves.map((m) => m.movedByName)).toEqual(["Name of ops-1", "Name of ops-1"]);
      expect(read?.moves.map((m) => [m.from?.id ?? null, m.to.id, m.note])).toEqual([
        [first.id, second.id, "For packing"],
        [null, first.id, null],
      ]);
      expect(read?.moreMoves).toBe(false);
      expect(await service().artworkLocation("00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });

  describe("the list", () => {
    it("audits adding a location in the same transaction", async () => {
      const added = await addLocation();
      const audit = await auditRows([added.id], "artwork_location.add");
      expect(audit).toHaveLength(1);
      expect(audit[0]?.capability).toBe("artwork_location.manage");
      expect(audit[0]?.targetType).toBe("artwork_location");
    });

    it("refuses a taken name with 409, leaving no audit row", async () => {
      const name = `Gallery main room ${integrationSuffix("g")}`;
      await addLocation(name);
      await expect(
        service().addLocation({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          name: name.toUpperCase(),
          note: null,
        }),
      ).rejects.toSatisfy(
        // A taken name is not a stale version: no version to reload to.
        (error: ShopApiError) => error.statusCode === 409 && !("currentVersion" in error),
      );
      const rows = await owner()
        .select()
        .from(artworkLocation)
        .where(inArray(artworkLocation.name, [name, name.toUpperCase()]));
      expect(rows).toHaveLength(1);
      expect(await auditRows([rows[0]?.id ?? ""])).toHaveLength(1);
    });

    it("names every field at fault, so the form can show each beside its field", async () => {
      await expect(
        service().addLocation({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          name: "  ",
          note: "x".repeat(201),
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Give the location a name.",
        issues: [
          { field: "name", message: "Give the location a name." },
          { field: "note", message: "Keep the note to 200 characters or fewer." },
        ],
      });
      const a = await artwork();
      const store = await addLocation();
      await expect(
        service().moveArtworks({
          actorSubjectId: "ops-1",
          idempotencyKey: key(),
          request: { registerIds: [a], locationId: store.id, note: "x".repeat(501) },
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        issues: [{ field: "note", message: "Keep the note to 500 characters or fewer." }],
      });
      expect(await moves([a])).toHaveLength(0);
    });

    it("refuses an empty or over-long name before opening a transaction", async () => {
      for (const name of ["   ", "x".repeat(81)]) {
        await expect(
          service().addLocation({ actorSubjectId: "admin-1", idempotencyKey: key(), name }),
        ).rejects.toMatchObject({ statusCode: 400 });
      }
    });

    it("audits a rename with before and after, and refuses a stale version", async () => {
      const added = await addLocation();
      const renamed = await service().updateLocation({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        locationId: added.id,
        expectedVersion: added.version,
        name: `${added.name} (east)`,
        note: "By the loading bay",
      });
      expect(renamed.location.version).toBe(added.version + 1);
      const [row] = await auditRows([added.id], "artwork_location.update");
      expect(JSON.parse(row?.beforeJson ?? "{}")).toMatchObject({ name: added.name });
      expect(JSON.parse(row?.afterJson ?? "{}")).toMatchObject({
        name: `${added.name} (east)`,
        note: "By the loading bay",
      });

      await expect(
        service().updateLocation({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          locationId: added.id,
          expectedVersion: added.version,
          name: "Overwritten",
        }),
      ).rejects.toMatchObject({ statusCode: 409, currentVersion: String(added.version + 1) });
      expect(await auditRows([added.id], "artwork_location.update")).toHaveLength(1);
    });

    it("changes nothing for a rename to the name and note it has: no version, audit or event", async () => {
      const a = await artwork();
      const added = await addLocation();
      await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey: key(),
        request: { registerIds: [a], locationId: added.id },
      });
      const eventsBefore = (await locationEvents([a])).length;
      const same = await service().updateLocation({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        locationId: added.id,
        expectedVersion: added.version,
        // Trimmed to the same name; no note either way.
        name: `  ${added.name} `,
        note: "",
      });
      expect(same.changed).toBe(false);
      expect(same.location.version).toBe(added.version);
      expect(await auditRows([added.id], "artwork_location.update")).toHaveLength(0);
      expect(await locationEvents([a])).toHaveLength(eventsBefore);
    });

    it("audits retiring once; retiring again changes nothing and writes no audit row", async () => {
      const added = await addLocation();
      const retired = await service().retireLocation({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        locationId: added.id,
        expectedVersion: added.version,
      });
      expect(retired.changed).toBe(true);
      const again = await service().retireLocation({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        locationId: added.id,
        expectedVersion: retired.location.version,
      });
      expect(again.changed).toBe(false);
      expect(again.location.version).toBe(retired.location.version);
      expect(await auditRows([added.id], "artwork_location.retire")).toHaveLength(1);

      const restored = await service().restoreLocation({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        locationId: added.id,
        expectedVersion: retired.location.version,
      });
      expect(restored.location.status).toBe("active");
      expect(await auditRows([added.id], "artwork_location.restore")).toHaveLength(1);
    });

    it("leaves the location active and no audit row when retiring fails after the audit", async () => {
      const a = await artwork();
      const added = await addLocation();
      await service().moveArtworks({
        actorSubjectId: "ops-1",
        idempotencyKey: key(),
        request: { registerIds: [a], locationId: added.id },
      });
      const eventsBefore = (await locationEvents([a])).length;
      await expect(
        service(failingAfterAudit()).retireLocation({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          locationId: added.id,
          expectedVersion: added.version,
        }),
      ).rejects.toThrow("failed after the audit row");
      const [row] = await owner()
        .select()
        .from(artworkLocation)
        .where(eq(artworkLocation.id, added.id));
      expect(row?.status).toBe("active");
      expect(row?.version).toBe(added.version);
      expect(await auditRows([added.id], "artwork_location.retire")).toHaveLength(0);
      expect(await locationEvents([a])).toHaveLength(eventsBefore);
    });

    it("lists active locations, and retired ones when asked", async () => {
      const added = await addLocation();
      await service().retireLocation({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        locationId: added.id,
        expectedVersion: added.version,
      });
      const active = await service().listLocations({});
      const all = await service().listLocations({ includeRetired: true });
      expect(active.items.some((l) => l.id === added.id)).toBe(false);
      expect(all.items.find((l) => l.id === added.id)?.status).toBe("retired");
    });
  });
});
