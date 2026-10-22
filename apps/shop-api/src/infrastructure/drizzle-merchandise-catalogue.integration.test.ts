import { shopAdminAudit, shopOrder, shopProduct, shopProductVariant } from "@auction/db/schema";
import {
  MERCHANDISE_SKU_IN_USE_MESSAGE,
  MERCHANDISE_SLUG_IN_USE_MESSAGE,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StaleVersionError } from "../errors/stale-version-error.js";
import {
  insertTestMerchandise,
  integrationSuffix,
  requireDefined,
} from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleAdminReadRepository } from "./drizzle-admin-read.repository.js";
import { createDrizzleBasketRepository } from "./drizzle-basket.repository.js";
import { createDrizzleMerchandiseCatalogueRepository } from "./drizzle-merchandise-catalogue.repository.js";
import { createDrizzleMerchandiseCatalogueWriter } from "./drizzle-merchandise-catalogue.writer.js";
import { createDrizzleMerchandiseStockWriter } from "./drizzle-merchandise-stock.writer.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { reserveProductVariantsForCheckoutOrder } from "./shop-checkout-reservation.js";

const ACTOR = "merchandise-it-staff";
const key = () => `idem-${integrationSuffix("m")}`;

describe.skipIf(!hasShopIntegrationDb)("merchandise catalogue administration", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup() {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    return {
      db,
      writer: createDrizzleMerchandiseCatalogueWriter(uow),
      stock: createDrizzleMerchandiseStockWriter(uow),
      reader: createDrizzleAdminReadRepository(db).catalogue,
      publicCatalogue: createDrizzleMerchandiseCatalogueRepository(db),
      auditActions: async (targetId: string) =>
        (
          await db
            .select({ action: shopAdminAudit.action, capability: shopAdminAudit.capability })
            .from(shopAdminAudit)
            .where(eq(shopAdminAudit.targetId, targetId))
            .orderBy(shopAdminAudit.createdAt)
        ).map((row) => row.action),
    };
  }

  async function product(label: string) {
    const { db } = setup();
    return insertTestMerchandise(db, label, { onHand: 5 });
  }

  async function detailOf(productId: string) {
    return requireDefined(await setup().reader.getMerchandiseProduct(productId), "product detail");
  }

  describe("product edits", () => {
    it("saves every field, moves the version on and audits before and after", async () => {
      const { writer, auditActions } = setup();
      const merch = await product("edit");
      const opened = await detailOf(merch.productId);

      const { version } = await writer.updateProduct({
        productId: merch.productId,
        slug: `${merch.slug}-renamed`,
        title: "Renamed",
        description: "New copy.",
        expectedVersion: opened.version,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });

      const saved = await detailOf(merch.productId);
      expect(saved).toMatchObject({
        slug: `${merch.slug}-renamed`,
        title: "Renamed",
        description: "New copy.",
        version,
      });
      expect(version).not.toBe(opened.version);
      expect(await auditActions(merch.productId)).toEqual(["update_merchandise_product"]);
    });

    it("refuses a stale version with the current one and writes nothing", async () => {
      const { writer, auditActions } = setup();
      const merch = await product("stale");
      const opened = await detailOf(merch.productId);
      const first = await writer.updateProduct({
        productId: merch.productId,
        slug: merch.slug,
        title: "First save",
        description: null,
        expectedVersion: opened.version,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });

      const second = writer.updateProduct({
        productId: merch.productId,
        slug: merch.slug,
        title: "Second save from the stale form",
        description: null,
        expectedVersion: opened.version,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });

      await expect(second).rejects.toBeInstanceOf(StaleVersionError);
      await expect(second).rejects.toMatchObject({
        currentVersion: first.version,
        statusCode: 409,
      });
      expect((await detailOf(merch.productId)).title).toBe("First save");
      expect(await auditActions(merch.productId)).toEqual(["update_merchandise_product"]);
    });

    it("refuses a slug another product already uses", async () => {
      const { writer, auditActions } = setup();
      const mine = await product("slug-mine");
      const other = await product("slug-other");
      const opened = await detailOf(mine.productId);

      await expect(
        writer.updateProduct({
          productId: mine.productId,
          slug: other.slug,
          title: "Mine",
          description: null,
          expectedVersion: opened.version,
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({
        code: SHOP_API_ERROR_CODES.CONFLICT,
        message: MERCHANDISE_SLUG_IN_USE_MESSAGE,
        statusCode: 409,
      });
      expect((await detailOf(mine.productId)).slug).toBe(mine.slug);
      expect(await auditActions(mine.productId)).toEqual([]);
    });

    it("replays a repeated request without a second audit row", async () => {
      const { writer, auditActions } = setup();
      const merch = await product("replay");
      const opened = await detailOf(merch.productId);
      const request = {
        productId: merch.productId,
        slug: merch.slug,
        title: "Once",
        description: null,
        expectedVersion: opened.version,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      };

      const first = await writer.updateProduct(request);
      const again = await writer.updateProduct(request);

      expect(again).toEqual(first);
      expect(await auditActions(merch.productId)).toEqual(["update_merchandise_product"]);
    });

    it("answers 404 for a product that does not exist", async () => {
      await expect(
        setup().writer.updateProduct({
          productId: "00000000-0000-4000-8000-0000000000aa",
          slug: "ghost",
          title: "Ghost",
          description: null,
          expectedVersion: new Date().toISOString(),
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("variants", () => {
    it("adds a variant with no stock, edits it, and audits each step", async () => {
      const { writer, auditActions } = setup();
      const merch = await product("variant");
      const sku = `NEW-${integrationSuffix("v")}`;

      const { variantId } = await writer.addVariant({
        productId: merch.productId,
        sku,
        pricePence: 2400,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      await writer.updateVariant({
        variantId,
        sku: `${sku}-B`,
        pricePence: 2600,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });

      const added = (await detailOf(merch.productId)).variants.find(
        (v) => v.variantId === variantId,
      );
      expect(added).toMatchObject({
        sku: `${sku}-B`,
        pricePence: 2600,
        onHand: 0,
        reserved: 0,
        status: "active",
      });
      expect(await auditActions(variantId)).toEqual([
        "add_merchandise_variant",
        "update_merchandise_variant",
      ]);
    });

    it("refuses a SKU already used by any variant, on add and on edit", async () => {
      const { writer, auditActions } = setup();
      const merch = await product("sku");
      const other = await product("sku-other");

      await expect(
        writer.addVariant({
          productId: merch.productId,
          sku: other.sku,
          pricePence: 100,
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({ message: MERCHANDISE_SKU_IN_USE_MESSAGE, statusCode: 409 });
      await expect(
        writer.updateVariant({
          variantId: merch.variantId,
          sku: other.sku,
          pricePence: 100,
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({ message: MERCHANDISE_SKU_IN_USE_MESSAGE, statusCode: 409 });
      expect((await detailOf(merch.productId)).variants).toHaveLength(1);
      expect(await auditActions(merch.variantId)).toEqual([]);
    });

    it("archives and restores a variant, keeping its SKU and stock", async () => {
      const { writer, auditActions } = setup();
      const merch = await product("variant-archive");

      await writer.setVariantArchived({
        variantId: merch.variantId,
        archived: true,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      expect((await detailOf(merch.productId)).variants[0]).toMatchObject({
        status: "archived",
        sku: merch.sku,
        onHand: 5,
      });
      await writer.setVariantArchived({
        variantId: merch.variantId,
        archived: false,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      expect((await detailOf(merch.productId)).variants[0]?.status).toBe("active");
      expect(await auditActions(merch.variantId)).toEqual([
        "archive_merchandise_variant",
        "restore_merchandise_variant",
      ]);
    });
  });

  describe("stock", () => {
    it("records the reason in the audit entry and refuses to go below reserved", async () => {
      const { stock, db } = setup();
      const merch = await product("stock");
      await db
        .update(shopProductVariant)
        .set({ reserved: 2 })
        .where(eq(shopProductVariant.id, merch.variantId));

      await stock.adjustVariantOnHand({
        variantId: merch.variantId,
        onHand: 9,
        reason: "Recount after delivery",
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      await expect(
        stock.adjustVariantOnHand({
          variantId: merch.variantId,
          onHand: 1,
          reason: "Too low",
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      const [audit] = await db
        .select({ afterJson: shopAdminAudit.afterJson })
        .from(shopAdminAudit)
        .where(eq(shopAdminAudit.targetId, merch.variantId));
      expect(JSON.parse(String(audit?.afterJson))).toMatchObject({
        onHand: 9,
        reason: "Recount after delivery",
      });
    });
  });

  describe("archiving a product", () => {
    async function orderFor(variantId: string, pricePence: number) {
      const { db } = setup();
      const suffix = integrationSuffix("order");
      const [order] = await db
        .insert(shopOrder)
        .values({
          identitySubjectId: `subject-${suffix}`,
          fulfilment: "collect_brunswick",
          merchandiseSubtotalPence: pricePence,
          fulfilmentSurchargePence: 0,
          totalPence: pricePence,
          idempotencyKey: `idem-${suffix}`,
          status: "pending_payment",
        })
        .returning({ id: shopOrder.id });
      const orderId = requireDefined(order?.id, "order id");
      await db.transaction((tx) =>
        reserveProductVariantsForCheckoutOrder(tx, {
          orderId,
          expandedLines: [{ productVariantId: variantId, unitPricePence: pricePence }],
        }),
      );
      return orderId;
    }

    it("takes the product off the public shop and out of baskets and checkout, and restores it", async () => {
      const { db, writer, publicCatalogue, auditActions } = setup();
      const merch = await product("archive");
      const baskets = createDrizzleBasketRepository(db, { merchandiseEnabled: true });
      const owner = {
        kind: "subject" as const,
        identitySubjectId: `integration-subject-${integrationSuffix("archive")}`,
      };
      expect(await publicCatalogue.getPublicProductBySlug(merch.slug)).not.toBeNull();

      await writer.setProductArchived({
        productId: merch.productId,
        archived: true,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });

      expect(await publicCatalogue.getPublicProductBySlug(merch.slug)).toBeNull();
      const listed = await publicCatalogue.listPublicProducts({ limit: 100 });
      expect(listed.items.map((item) => item.slug)).not.toContain(merch.slug);
      await expect(
        baskets.addOrUpdateLine({ owner, productVariantId: merch.variantId, quantity: 1 }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        db.transaction((tx) =>
          reserveProductVariantsForCheckoutOrder(tx, {
            orderId: "00000000-0000-4000-8000-0000000000bb",
            expandedLines: [{ productVariantId: merch.variantId, unitPricePence: 100 }],
          }),
        ),
      ).rejects.toMatchObject({ code: SHOP_API_ERROR_CODES.OUT_OF_STOCK });

      await writer.setProductArchived({
        productId: merch.productId,
        archived: false,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      expect(await publicCatalogue.getPublicProductBySlug(merch.slug)).not.toBeNull();
      expect(await auditActions(merch.productId)).toEqual([
        "archive_merchandise_product",
        "restore_merchandise_product",
      ]);
    });

    it("is allowed with open orders, which keep their stock and the product row", async () => {
      const { writer, db } = setup();
      const merch = await product("archive-ordered");
      await orderFor(merch.variantId, 1500);

      await writer.setProductArchived({
        productId: merch.productId,
        archived: true,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });

      const detail = await detailOf(merch.productId);
      expect(detail.status).toBe("archived");
      expect(detail.variants[0]).toMatchObject({ reserved: 1, onHand: 5 });
      // Order lines point at the product, so removing the row is impossible, not merely unrouted.
      await expect(
        ownerPool.query("delete from shop_product where id = $1", [merch.productId]),
      ).rejects.toMatchObject({ code: "23503" });
      const [row] = await db.select().from(shopProduct).where(eq(shopProduct.id, merch.productId));
      expect(row?.archivedAt).not.toBeNull();
    });

    it("archiving twice is a no-op that writes one audit row", async () => {
      const { writer, auditActions } = setup();
      const merch = await product("archive-twice");
      for (let i = 0; i < 2; i += 1) {
        await writer.setProductArchived({
          productId: merch.productId,
          archived: true,
          actorSubjectId: ACTOR,
          idempotencyKey: key(),
        });
      }
      expect(await auditActions(merch.productId)).toEqual(["archive_merchandise_product"]);
    });
  });

  describe("admin list", () => {
    it("filters by status and by title, slug or SKU, counting only variants on sale", async () => {
      const { reader, writer } = setup();
      const merch = await product("list");
      const second = await writer.addVariant({
        productId: merch.productId,
        sku: `LIST-${integrationSuffix("s")}`,
        pricePence: 3000,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      const archivedVariant = await writer.addVariant({
        productId: merch.productId,
        sku: `LIST-OLD-${integrationSuffix("s")}`,
        pricePence: 9900,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      await writer.setVariantArchived({
        variantId: archivedVariant.variantId,
        archived: true,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });

      const byTitle = await reader.listMerchandiseProducts({ q: "Integration merch list" });
      const item = byTitle.items.find((candidate) => candidate.productId === merch.productId);
      expect(item).toMatchObject({
        status: "active",
        variantCount: 2,
        fromPricePence: 1500,
        toPricePence: 3000,
        totalOnHand: 5,
      });
      expect(second.variantId).toBeDefined();

      const bySku = await reader.listMerchandiseProducts({ q: merch.sku.toLowerCase() });
      expect(bySku.items.map((candidate) => candidate.productId)).toContain(merch.productId);

      const wildcard = await reader.listMerchandiseProducts({ q: "%" });
      expect(wildcard.items).toEqual([]);

      await writer.setProductArchived({
        productId: merch.productId,
        archived: true,
        actorSubjectId: ACTOR,
        idempotencyKey: key(),
      });
      const archived = await reader.listMerchandiseProducts({ status: "archived", q: merch.slug });
      expect(archived.items.map((candidate) => candidate.productId)).toEqual([merch.productId]);
      const active = await reader.listMerchandiseProducts({ status: "active", q: merch.slug });
      expect(active.items).toEqual([]);
    });
  });
});
