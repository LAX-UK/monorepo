import { randomUUID } from "node:crypto";
import { type Database, createDbFromPool } from "@auction/db";
import { consignorAgreement, shopAdminAudit } from "@auction/db/schema";
import { DrizzleConsignorAgreementStore } from "@auction/persistence/repositories";
import { and, eq, inArray, sql } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import {
  agreementFilePrefix,
  createConsignorAgreementFiles,
} from "../../infrastructure/consignor-agreement-files.js";
import {
  createDrizzleConsignorAgreementReads,
  createDrizzleConsignorAgreementWritesFor,
} from "../../infrastructure/drizzle-consignor-agreement.js";
import { createDrizzleShopUnitOfWork } from "../../infrastructure/drizzle-shop-transaction-effects.js";
import { createFakeObjectStorage } from "../../test-support/fake-object-storage.js";
import { integrationSuffix } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import type { ShopUnitOfWorkFactory } from "../ports/shop-unit-of-work.js";
import { createConsignorAgreementService } from "./consignor-agreement.service.js";

const NOW = new Date("2026-11-17T09:00:00.000Z");
const storeOn = (session: Database) => new DrizzleConsignorAgreementStore(session);
const key = () => `idem-${integrationSuffix("k")}`;
const PDF = Buffer.from("%PDF-1.7\n% signed agreement placeholder\n");

/**
 * Runs as `shop_app`, the role shop-api uses, so the grants from 0407 are shown to be enough for
 * the agreement, the audit row and the idempotency record together.
 */
describe.skipIf(!hasShopIntegrationDb)("consignor agreement service (Postgres)", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;
  const storage = createFakeObjectStorage();

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
    return createConsignorAgreementService({
      uow: uow ?? createDrizzleShopUnitOfWork(db, "off"),
      reads: createDrizzleConsignorAgreementReads(db, storeOn),
      writesFor: createDrizzleConsignorAgreementWritesFor(storeOn),
      files: createConsignorAgreementFiles(storage, () => NOW),
      clock: () => NOW,
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

  /** A signed file uploaded for the client, as the dialog's PUT leaves it. */
  function uploaded(partyId: string, body = PDF, contentType = "application/pdf") {
    const fileKey = `${agreementFilePrefix(partyId)}${randomUUID()}.pdf`;
    storage.objects.set(fileKey, { body, contentType });
    return fileKey;
  }

  const terms = (signedFileKey: string, patch: object = {}) => ({
    places: ["lax_bid", "lax_art"],
    startsOn: "2026-03-03",
    endsOn: "2027-03-02",
    lowestPricePence: 200_000,
    commissionBasisPoints: 2500,
    signedFileKey,
    note: "Signed at the gallery",
    ...patch,
  });

  async function add(partyId: string, patch: object = {}) {
    return service().add({
      actorSubjectId: "admin-1",
      idempotencyKey: key(),
      partyId,
      terms: terms(uploaded(partyId), patch),
    });
  }

  async function auditRows(agreementId: string, action?: string) {
    return owner()
      .select()
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.targetId, agreementId),
          ...(action ? [eq(shopAdminAudit.action, action)] : []),
        ),
      );
  }

  /** The audit row's JSON columns, which are stored as text. */
  const json = (value: unknown) =>
    typeof value === "string" ? (JSON.parse(value) as Record<string, unknown>) : value;

  async function versions(agreementId: string) {
    return owner()
      .select()
      .from(consignorAgreement)
      .where(eq(consignorAgreement.agreementId, agreementId));
  }

  describe("adding", () => {
    it("adds version 1 and audits it in the same transaction, without the note's text", async () => {
      const partyId = await client();
      const added = await add(partyId);
      expect(added).toMatchObject({
        version: 1,
        partyId,
        places: ["lax_bid", "lax_art"],
        status: "current",
        note: "Signed at the gallery",
      });
      const [row] = await auditRows(added.agreementId, "consignor_agreement.add");
      expect(row).toMatchObject({
        actorSubjectId: "admin-1",
        capability: "consignor_agreement.manage",
        targetType: "consignor_agreement",
      });
      expect(json(row?.afterJson)).toMatchObject({ partyId, version: 1, withNote: true });
      expect(JSON.stringify(row?.afterJson)).not.toContain("Signed at the gallery");
    });

    it("leaves no agreement and no audit row when the unit of work fails after the audit", async () => {
      const partyId = await client();
      await expect(
        service(failingAfterAudit()).add({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          partyId,
          terms: terms(uploaded(partyId)),
        }),
      ).rejects.toThrow("commit refused");
      expect((await service().list(partyId))?.items).toEqual([]);
    });

    it("answers a retry with the same key from the first result, adding and auditing once", async () => {
      const partyId = await client();
      const command = {
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        partyId,
        terms: terms(uploaded(partyId)),
      };
      const first = await service().add(command);
      const again = await service().add(command);
      expect(again).toEqual(first);
      expect((await service().list(partyId))?.items).toHaveLength(1);
      expect(await auditRows(first.agreementId)).toHaveLength(1);
    });

    it("names every field at fault before taking any lock", async () => {
      const partyId = await client();
      const refused = await service()
        .add({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          partyId,
          terms: { ...terms(""), places: [], endsOn: "2026-01-01" },
        })
        .catch((error: unknown) => error);
      expect(refused).toMatchObject({
        statusCode: 400,
        issues: [
          { field: "places", message: "Choose at least one place." },
          { field: "endsOn", message: "The end date must be on or after the start date." },
          { field: "signedFileKey", message: "Upload the signed agreement." },
        ],
      });
    });

    it.each([
      ["a file that was never uploaded", "missing"],
      ["another client's file", "other"],
      ["a file that is not what it says", "fake"],
    ])("refuses %s beside the file field", async (_label, kind) => {
      const partyId = await client();
      const other = await client();
      const fileKey =
        kind === "missing"
          ? `${agreementFilePrefix(partyId)}${randomUUID()}.pdf`
          : kind === "other"
            ? uploaded(other)
            : uploaded(partyId, Buffer.from("<html>not a pdf</html>"));
      const refused = await service()
        .add({ actorSubjectId: "admin-1", idempotencyKey: key(), partyId, terms: terms(fileKey) })
        .catch((error: unknown) => error);
      expect(refused).toMatchObject({ statusCode: 400, issues: [{ field: "signedFileKey" }] });
      expect((await service().list(partyId))?.items).toEqual([]);
    });

    it("lists the client by name with their agreements, and nothing for an unknown party", async () => {
      const partyId = await client("Ana Ruiz");
      await add(partyId);
      const list = await service().list(partyId);
      expect(list?.party).toEqual({ partyId, displayName: "Ana Ruiz" });
      expect(list?.items).toHaveLength(1);
      expect(await service().list(randomUUID())).toBeNull();
    });
  });

  describe("replacing", () => {
    it("adds the next version, marks the old one replaced and audits before and after", async () => {
      const partyId = await client();
      const first = await add(partyId);
      const second = await service().replace({
        actorSubjectId: "admin-2",
        idempotencyKey: key(),
        partyId,
        agreementId: first.agreementId,
        expectedVersion: 1,
        // The same signed file: a correction needs no new upload.
        terms: terms(first.signedFileKey, { places: ["private_sale"], lowestPricePence: null }),
      });
      expect(second).toMatchObject({
        agreementId: first.agreementId,
        version: 2,
        replacesId: first.id,
        places: ["private_sale"],
        lowestPricePence: null,
        status: "current",
      });
      const rows = await versions(first.agreementId);
      expect(rows.map((row) => [row.version, row.status]).sort()).toEqual([
        [1, "replaced"],
        [2, "current"],
      ]);
      // The page lists the agreement once, at its new version.
      expect((await service().list(partyId))?.items.map((item) => item.version)).toEqual([2]);
      const [audit] = await auditRows(first.agreementId, "consignor_agreement.replace");
      expect(json(audit?.beforeJson)).toMatchObject({ version: 1, places: ["lax_bid", "lax_art"] });
      expect(json(audit?.afterJson)).toMatchObject({ version: 2, places: ["private_sale"] });
    });

    it("refuses a stale version with the version it found, and writes nothing", async () => {
      const partyId = await client();
      const first = await add(partyId);
      await service().replace({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        partyId,
        agreementId: first.agreementId,
        expectedVersion: 1,
        terms: terms(first.signedFileKey),
      });
      await expect(
        service().replace({
          actorSubjectId: "admin-2",
          idempotencyKey: key(),
          partyId,
          agreementId: first.agreementId,
          expectedVersion: 1,
          terms: terms(first.signedFileKey, { commissionBasisPoints: 3000 }),
        }),
      ).rejects.toMatchObject({ statusCode: 409, currentVersion: "2" });
      expect(await versions(first.agreementId)).toHaveLength(2);
      expect(await auditRows(first.agreementId, "consignor_agreement.replace")).toHaveLength(1);
    });

    it("answers 404 for another client's agreement, so a URL cannot reach it", async () => {
      const partyId = await client();
      const other = await client();
      const first = await add(partyId);
      const refused = await service()
        .replace({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          partyId: other,
          agreementId: first.agreementId,
          expectedVersion: 1,
          terms: terms(first.signedFileKey),
        })
        .catch((error: unknown) => error);
      expect(refused).toBeInstanceOf(ShopApiError);
      expect(refused).toMatchObject({ statusCode: 404 });
      expect(await versions(first.agreementId)).toHaveLength(1);
    });
  });

  describe("retiring", () => {
    it("retires the current version, audits it, and refuses to change it after", async () => {
      const partyId = await client();
      const first = await add(partyId);
      const retired = await service().retire({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        partyId,
        agreementId: first.agreementId,
        expectedVersion: 1,
      });
      expect(retired).toMatchObject({
        version: 1,
        status: "retired",
        retiredAt: NOW.toISOString(),
      });
      const [audit] = await auditRows(first.agreementId, "consignor_agreement.retire");
      expect(json(audit?.beforeJson)).toMatchObject({ status: "current" });
      expect(json(audit?.afterJson)).toMatchObject({ status: "retired" });
      // Still on the page, as retired.
      expect((await service().list(partyId))?.items.map((item) => item.status)).toEqual([
        "retired",
      ]);
      await expect(
        service().replace({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          partyId,
          agreementId: first.agreementId,
          expectedVersion: 1,
          terms: terms(first.signedFileKey),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        service().retire({
          actorSubjectId: "admin-1",
          idempotencyKey: key(),
          partyId,
          agreementId: first.agreementId,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(await auditRows(first.agreementId, "consignor_agreement.retire")).toHaveLength(1);
    });
  });

  describe("signed files", () => {
    it("gives a short-lived link to a version's file, and only on its client's page", async () => {
      const partyId = await client();
      const other = await client();
      const first = await add(partyId);
      const link = await service().fileLink({ partyId, versionId: first.id });
      expect(link.url).toContain(first.signedFileKey);
      expect(link.expiresAt).toBe(new Date(NOW.getTime() + 300_000).toISOString());
      await expect(
        service().fileLink({ partyId: other, versionId: first.id }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("hands out an upload under the client's private prefix", async () => {
      const partyId = await client();
      const upload = await service().createFileUpload({
        partyId,
        contentType: "application/pdf",
        byteSize: 2048,
      });
      expect(upload.key.startsWith(agreementFilePrefix(partyId))).toBe(true);
      expect(upload.key.startsWith("shop/")).toBe(false);
      await expect(
        service().createFileUpload({
          partyId: randomUUID(),
          contentType: "image/png",
          byteSize: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  it("refuses to add or open files when storage is not set up", async () => {
    const partyId = await client();
    const db = createShopDb(shopPool);
    const withoutFiles = createConsignorAgreementService({
      uow: createDrizzleShopUnitOfWork(db, "off"),
      reads: createDrizzleConsignorAgreementReads(db, storeOn),
      writesFor: createDrizzleConsignorAgreementWritesFor(storeOn),
      files: null,
    });
    await expect(
      withoutFiles.add({
        actorSubjectId: "admin-1",
        idempotencyKey: key(),
        partyId,
        terms: terms(uploaded(partyId)),
      }),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(
      await owner()
        .select()
        .from(consignorAgreement)
        .where(inArray(consignorAgreement.partyId, [partyId])),
    ).toEqual([]);
  });
});
