import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEditionFramingService } from "../../application/framing/edition-framing.service.js";
import {
  grantLaxSaleAuthority,
  importTestArtwork,
  integrationSuffix,
} from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleBasketRepository } from "../drizzle-basket.repository.js";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleEditionFramingReader } from "./drizzle-edition-framing.store.js";
import { createDrizzleEditionFramingUnitOfWork } from "./drizzle-edition-framing.unit-of-work.js";

const STAFF = "edition-framing-integration-staff";

describe.skipIf(!hasShopIntegrationDb)("Framing on an edition against the database", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  const actor = () => ({
    actorSubjectId: STAFF,
    idempotencyKey: crypto.randomUUID(),
    maySetPrices: true,
  });

  /** An option with real prices, added straight to the table so each test owns its own. */
  async function addOption(name: string, status: "active" | "paused" = "active") {
    const code = `edfr-${integrationSuffix("opt")}`;
    const inserted = await ownerPool.query(
      `insert into shop_framing_option
         (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days, status, sort_order)
       values ($1, $2, 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 950)
       returning id`,
      [code, name],
    );
    const id = (inserted.rows[0] as { id: string }).id;
    await ownerPool.query(
      `insert into shop_framing_option_price (option_id, band, price_pence, is_placeholder)
       values ($1, 'up_to_40x50', 12000, false), ($1, 'up_to_60x80', 19500, false), ($1, 'up_to_80x100', 26000, false)`,
      [id],
    );
    if (status === "active") {
      await ownerPool.query("update shop_framing_option set status = 'active' where id = $1", [id]);
    }
    return id;
  }

  async function sellableEdition(label: string, sheet: string | null = "50 × 70 cm") {
    const db = createShopDb(shopPool);
    const edition = await importTestArtwork(db, label);
    await grantLaxSaleAuthority(db, edition.artworkId, 3);
    await ownerPool.query(
      "update shop_artwork set print_size = $2, print_price_pence = 18000 where id = $1",
      [edition.artworkId, sheet],
    );
    const slug = (
      (await ownerPool.query("select slug from shop_artwork where id = $1", [edition.artworkId]))
        .rows[0] as { slug: string }
    ).slug;
    return { artworkId: edition.artworkId, slug };
  }

  function services() {
    const db = createShopDb(shopPool);
    return {
      db,
      framing: createEditionFramingService({
        uow: createDrizzleEditionFramingUnitOfWork(createDrizzleShopUnitOfWork(db, "off")),
      }),
      reader: createDrizzleEditionFramingReader(db),
      basket: createDrizzleBasketRepository(db, {
        merchandiseEnabled: false,
        framingEnabled: true,
        editionOrderLimit: null,
      }),
    };
  }

  const owner = () => ({ kind: "anonymous" as const, tokenHash: `edfr-${crypto.randomUUID()}` });

  it("saves an edition's framing, reads it back for buyers and prices it for the band", async () => {
    const { framing, reader } = services();
    const edition = await sellableEdition("edfr-save");
    const oak = await addOption("Natural oak frame");
    const walnut = await addOption("Walnut frame", "paused");

    const view = await framing.get(edition.artworkId);
    expect(view).toMatchObject({ mode: "unframed_or_framed", band: "up_to_60x80", version: null });

    const saved = await framing.save({
      ...actor(),
      artworkId: edition.artworkId,
      body: {
        mode: "unframed_or_framed",
        framedByArtist: "",
        offers: [{ optionId: oak, overridePence: 21000 }],
        expectedVersion: null,
      },
    });
    expect(saved.options.find((o) => o.optionId === oak)).toMatchObject({
      offered: true,
      overridePence: 21000,
      cataloguePricePence: 19500,
    });

    // The paused option cannot be newly offered.
    await expect(
      framing.save({
        ...actor(),
        artworkId: edition.artworkId,
        body: {
          mode: "unframed_or_framed",
          framedByArtist: "",
          offers: [
            { optionId: oak, overridePence: 21000 },
            { optionId: walnut, overridePence: null },
          ],
          expectedVersion: saved.version,
        },
      }),
    ).rejects.toThrow(/cannot be shown yet/);

    const facts = await reader.readBySlug(edition.slug);
    expect(facts?.offers.map((offer) => [offer.optionId, offer.overridePence])).toEqual([
      [oak, 21000],
    ]);
  });

  it("puts a framed print in the basket at the edition's price, and changes or clears the framing", async () => {
    const { framing, basket } = services();
    const edition = await sellableEdition("edfr-basket");
    const oak = await addOption("Natural oak frame");
    const black = await addOption("Black wood frame");
    await framing.save({
      ...actor(),
      artworkId: edition.artworkId,
      body: {
        mode: "unframed_or_framed",
        framedByArtist: "",
        offers: [
          { optionId: oak, overridePence: 21000 },
          { optionId: black, overridePence: null },
        ],
        expectedVersion: null,
      },
    });
    const who = owner();

    const added = await basket.addOrUpdateLine({
      owner: who,
      artworkSlug: edition.slug,
      quantity: 1,
      framingOptionId: oak,
    });
    const line = added.lines[0];
    expect(line?.unitPricePence).toBe(18000);
    expect(line?.framing).toMatchObject({ optionId: oak, pricePence: 21000, available: true });

    // A quantity change keeps the framing.
    const again = await basket.addOrUpdateLine({
      owner: who,
      artworkSlug: edition.slug,
      quantity: 2,
    });
    expect(again.lines[0]?.framing?.optionId).toBe(oak);

    const changed = await basket.setLineFraming({
      owner: who,
      lineId: line?.lineId ?? "",
      framingOptionId: black,
    });
    expect(changed.lines[0]?.framing).toMatchObject({ optionId: black, pricePence: 19500 });

    const cleared = await basket.setLineFraming({
      owner: who,
      lineId: line?.lineId ?? "",
      framingOptionId: null,
    });
    expect(cleared.lines[0]?.framing).toBeNull();
  });

  it("refuses framing an edition does not offer, and asks for a frame on a framed-only edition", async () => {
    const { framing, basket } = services();
    const edition = await sellableEdition("edfr-refuse");
    const oak = await addOption("Natural oak frame");
    const other = await addOption("Black wood frame");
    await framing.save({
      ...actor(),
      artworkId: edition.artworkId,
      body: {
        mode: "framed_only",
        framedByArtist: "",
        offers: [{ optionId: oak, overridePence: null }],
        expectedVersion: null,
      },
    });
    const who = owner();
    await expect(
      basket.addOrUpdateLine({ owner: who, artworkSlug: edition.slug, quantity: 1 }),
    ).rejects.toThrow(/Choose a frame/);
    await expect(
      basket.addOrUpdateLine({
        owner: who,
        artworkSlug: edition.slug,
        quantity: 1,
        framingOptionId: other,
      }),
    ).rejects.toThrow(/not offered for this edition/);
    const ok = await basket.addOrUpdateLine({
      owner: who,
      artworkSlug: edition.slug,
      quantity: 1,
      framingOptionId: oak,
    });
    expect(ok.lines[0]?.framing?.optionId).toBe(oak);
  });

  it("marks a line unavailable when its option is paused afterwards, and still takes a quantity change", async () => {
    const { framing, basket } = services();
    const edition = await sellableEdition("edfr-paused");
    const oak = await addOption("Natural oak frame");
    await framing.save({
      ...actor(),
      artworkId: edition.artworkId,
      body: {
        mode: "unframed_or_framed",
        framedByArtist: "",
        offers: [{ optionId: oak, overridePence: null }],
        expectedVersion: null,
      },
    });
    const who = owner();
    await basket.addOrUpdateLine({
      owner: who,
      artworkSlug: edition.slug,
      quantity: 1,
      framingOptionId: oak,
    });
    await ownerPool.query("update shop_framing_option set status = 'paused' where id = $1", [oak]);

    const record = await basket.getBasket(who);
    expect(record?.lines[0]?.framing).toMatchObject({
      name: "Natural oak frame",
      available: false,
    });
    // A quantity change keeps the saved choice and stays flagged; it is not refused.
    const bumped = await basket.addOrUpdateLine({
      owner: who,
      artworkSlug: edition.slug,
      quantity: 2,
    });
    expect(bumped.lines[0]?.quantity).toBe(2);
    expect(bumped.lines[0]?.framing).toMatchObject({ optionId: oak, available: false });
    // Choosing that frame again is refused.
    await expect(
      basket.addOrUpdateLine({
        owner: who,
        artworkSlug: edition.slug,
        quantity: 2,
        framingOptionId: oak,
      }),
    ).rejects.toThrow(/not available right now/);
    // Going unframed is always possible.
    const unframed = await basket.setLineFraming({
      owner: who,
      lineId: record?.lines[0]?.lineId ?? "",
      framingOptionId: null,
    });
    expect(unframed.lines[0]?.framing).toBeNull();
  });

  it("keeps framing off baskets entirely while the flag is off", async () => {
    const { db, framing } = services();
    const edition = await sellableEdition("edfr-off");
    const oak = await addOption("Natural oak frame");
    await framing.save({
      ...actor(),
      artworkId: edition.artworkId,
      body: {
        mode: "unframed_or_framed",
        framedByArtist: "",
        offers: [{ optionId: oak, overridePence: null }],
        expectedVersion: null,
      },
    });
    const off = createDrizzleBasketRepository(db, { merchandiseEnabled: false });
    await expect(
      off.addOrUpdateLine({
        owner: owner(),
        artworkSlug: edition.slug,
        quantity: 1,
        framingOptionId: oak,
      }),
    ).rejects.toThrow(/Framing is not available/);
    await expect(
      off.setLineFraming({ owner: owner(), lineId: crypto.randomUUID(), framingOptionId: oak }),
    ).rejects.toThrow(/Framing is not available/);
    const plain = await off.addOrUpdateLine({
      owner: owner(),
      artworkSlug: edition.slug,
      quantity: 1,
    });
    expect(plain.lines[0]?.framing).toBeNull();
  });
});
