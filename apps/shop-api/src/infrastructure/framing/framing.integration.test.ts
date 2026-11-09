import { shopAdminAudit, shopFramingEditionOffer, shopFramingOption } from "@auction/db/schema";
import { FRAMING_LAUNCH_OPTIONS } from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFramingService } from "../../application/framing/framing.service.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { importTestArtwork, integrationSuffix } from "../../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../../test-support/shop-integration-setup.js";
import { createDrizzleShopUnitOfWork } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleFramingListReader } from "./drizzle-framing.store.js";
import { createDrizzleFramingUnitOfWork } from "./drizzle-framing.unit-of-work.js";

const STAFF = "framing-integration-staff";

describe.skipIf(!hasShopIntegrationDb)("The framing catalogue against the database", () => {
  let ownerPool: pg.Pool;
  let shopPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await ownerPool.end();
    await shopPool.end();
  });

  function serviceOn() {
    const db = createShopDb(shopPool);
    return {
      db,
      service: createFramingService({
        uow: createDrizzleFramingUnitOfWork(createDrizzleShopUnitOfWork(db, "off")),
        lists: createDrizzleFramingListReader(db),
      }),
    };
  }

  const actor = () => ({ actorSubjectId: STAFF, idempotencyKey: crypto.randomUUID() });

  it("starts with the launch options as drafts with placeholder prices, in list order", async () => {
    const { service } = serviceOn();
    const { items } = await service.list();
    const launch = FRAMING_LAUNCH_OPTIONS.map((expected) => ({
      expected,
      found: items.find((item) => item.code === expected.code),
    }));
    for (const { expected, found } of launch) {
      expect(found, expected.code).toMatchObject({
        name: expected.name,
        frame: expected.frame,
        mount: expected.mount,
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: expected.leadTimeMinDays,
        leadTimeMaxDays: expected.leadTimeMaxDays,
        pricesPence: expected.pricesPence,
      });
    }
    // Staff may have worked on them since the seed; a fresh database has them as drafts.
    const untouched = launch.filter(({ found }) => found?.placeholderBands.length === 3);
    for (const { found } of untouched) expect(found?.status).toBe("draft");
    const order = items.map((item) => item.code);
    expect(order.indexOf("black-wood")).toBeLessThan(order.indexOf("natural-oak-float"));
  });

  it("adds, edits, offers and pauses an option, auditing each step", async () => {
    const { service, db } = serviceOn();
    const name = `Walnut ${integrationSuffix("framing")}`;
    const created = await service.create({
      ...actor(),
      body: {
        name,
        frame: "natural_oak",
        mount: "window_conservation",
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: 15,
        leadTimeMaxDays: 20,
        pricesPence: { up_to_40x50: 16000, up_to_60x80: 25000, up_to_80x100: 32500 },
        offered: false,
      },
    });
    expect(created).toMatchObject({ name, status: "draft", placeholderBands: [] });

    const offered = await service.offer({
      ...actor(),
      optionId: created.id,
      body: { offered: true, expectedVersion: created.version },
    });
    expect(offered.status).toBe("active");

    const edited = await service.update({
      ...actor(),
      optionId: created.id,
      body: {
        name,
        frame: "natural_oak",
        mount: "float_conservation",
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: 15,
        leadTimeMaxDays: 25,
        pricesPence: { up_to_40x50: 17000, up_to_60x80: 25000, up_to_80x100: 32500 },
        offered: true,
        expectedVersion: offered.version,
      },
    });
    expect(edited).toMatchObject({
      mount: "float_conservation",
      leadTimeMaxDays: 25,
      pricesPence: { up_to_40x50: 17000 },
      status: "active",
    });

    const paused = await service.offer({
      ...actor(),
      optionId: created.id,
      body: { offered: false, expectedVersion: edited.version },
    });
    expect(paused.status).toBe("paused");

    const actions = (
      await db.select().from(shopAdminAudit).where(eq(shopAdminAudit.targetId, created.id))
    )
      .map((row) => row.action)
      .sort();
    expect(actions).toEqual(["framing.create", "framing.offer", "framing.pause", "framing.update"]);
  });

  it("refuses a save made from an older version", async () => {
    const { service } = serviceOn();
    const created = await service.create({
      ...actor(),
      body: {
        name: `Stale ${integrationSuffix("framing")}`,
        frame: "black_wood",
        mount: "window_conservation",
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: 10,
        leadTimeMaxDays: 15,
        pricesPence: { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 },
        offered: false,
      },
    });
    await service.offer({
      ...actor(),
      optionId: created.id,
      body: { offered: false, expectedVersion: created.version },
    });
    await expect(
      service.offer({
        ...actor(),
        optionId: created.id,
        body: { offered: true, expectedVersion: created.version },
      }),
    ).rejects.toBeInstanceOf(StaleVersionError);
  });

  it("gives two options with the same name different codes", async () => {
    const { service } = serviceOn();
    const body = {
      name: `Twin ${integrationSuffix("framing")}`,
      frame: "white_wood" as const,
      mount: "window_conservation" as const,
      glazing: "uv_acrylic" as const,
      hanging: "d_rings_cord" as const,
      leadTimeMinDays: 10,
      leadTimeMaxDays: 15,
      pricesPence: { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 },
      offered: false,
    };
    const first = await service.create({ ...actor(), body });
    const second = await service.create({ ...actor(), body });
    expect(second.code).toBe(`${first.code}-2`);
  });

  it("counts the editions that offer an option", async () => {
    const { service, db } = serviceOn();
    const created = await service.create({
      ...actor(),
      body: {
        name: `Counted ${integrationSuffix("framing")}`,
        frame: "black_wood",
        mount: "window_conservation",
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: 10,
        leadTimeMaxDays: 15,
        pricesPence: { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 },
        offered: false,
      },
    });
    const artwork = await importTestArtwork(db, "framing-count");
    await ownerPool.query(
      `insert into shop_framing_edition_offer (option_id, artwork_id, price_override_pence)
       values ($1, $2, $3)`,
      [created.id, artwork.artworkId, 21000],
    );
    const found = (await service.list()).items.find((item) => item.id === created.id);
    expect(found?.editionCount).toBe(1);
    const [offer] = await db
      .select()
      .from(shopFramingEditionOffer)
      .where(eq(shopFramingEditionOffer.optionId, created.id));
    expect(offer?.priceOverridePence).toBe(21000);
  });

  it("holds the rules in the table too: no active option while a band is a placeholder", async () => {
    const [seeded] = await ownerPool
      .query(
        "select o.id from shop_framing_option o where o.status = 'draft' and exists (select 1 from shop_framing_option_price p where p.option_id = o.id and p.is_placeholder) limit 1",
      )
      .then((result) => result.rows as { id: string }[]);
    if (!seeded) return;
    await expect(
      ownerPool.query("update shop_framing_option set status = 'active' where id = $1", [
        seeded.id,
      ]),
    ).rejects.toThrow(/shop_framing_option_placeholder_not_offered_ck/);
    await expect(
      ownerPool.query("update shop_framing_option set lead_time_max_days = 0 where id = $1", [
        seeded.id,
      ]),
    ).rejects.toThrow(/shop_framing_option_lead_time_ck/);
    expect(await shopPoolCheck(seeded.id)).toBe("draft");
  });

  it("will not let a price become a placeholder on an active option, and one band alone is not enough", async () => {
    const { service } = serviceOn();
    const created = await service.create({
      ...actor(),
      body: {
        name: `Live ${integrationSuffix("framing")}`,
        frame: "black_wood",
        mount: "window_conservation",
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: 10,
        leadTimeMaxDays: 15,
        pricesPence: { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 },
        offered: true,
      },
    });
    expect(created.status).toBe("active");
    await expect(
      ownerPool.query(
        "update shop_framing_option_price set is_placeholder = true where option_id = $1 and band = 'up_to_60x80'",
        [created.id],
      ),
    ).rejects.toThrow(/shop_framing_option_placeholder_not_offered_ck/);
  });

  it("serialises a price becoming a placeholder with the option going live, so both cannot pass", async () => {
    const { service } = serviceOn();
    const draft = await service.create({
      ...actor(),
      body: {
        name: `Race ${integrationSuffix("framing")}`,
        frame: "black_wood",
        mount: "window_conservation",
        glazing: "uv_acrylic",
        hanging: "d_rings_cord",
        leadTimeMinDays: 10,
        leadTimeMaxDays: 15,
        pricesPence: { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 },
        offered: false,
      },
    });
    const first = await ownerPool.connect();
    const second = await ownerPool.connect();
    try {
      await first.query("begin");
      await first.query(
        "update shop_framing_option_price set is_placeholder = true where option_id = $1 and band = 'up_to_60x80'",
        [draft.id],
      );
      // The option goes live while the first change is still open: it has to wait for it.
      let secondSettled = false;
      const goLive = second
        .query("update shop_framing_option set status = 'active' where id = $1", [draft.id])
        .then(
          () => ({ failed: false }),
          (error: Error) => ({ failed: true, message: error.message }),
        )
        .finally(() => {
          secondSettled = true;
        });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(secondSettled).toBe(false);
      await first.query("commit");
      const outcome = await goLive;
      expect(outcome.failed).toBe(true);
      expect(outcome).toMatchObject({
        message: expect.stringMatching(/shop_framing_option_placeholder_not_offered_ck/),
      });
      expect(await shopPoolCheck(draft.id)).toBe("draft");
    } finally {
      await first.query("rollback").catch(() => undefined);
      first.release();
      second.release();
    }
  });

  it("offers an option with placeholder prices only once every band is changed or confirmed", async () => {
    const { service } = serviceOn();
    // A copy of a seeded option, so the launch options themselves are left as they were.
    const code = `placeholder-${integrationSuffix("framing")}`;
    const inserted = await ownerPool.query(
      `insert into shop_framing_option
         (code, name, frame, mount, glazing, hanging, lead_time_min_days, lead_time_max_days, status, sort_order)
       values ($1, $2, 'natural_oak', 'window_conservation', 'uv_acrylic', 'd_rings_cord', 10, 15, 'draft', 900)
       returning id`,
      [code, `Placeholder ${code}`],
    );
    const optionId = (inserted.rows[0] as { id: string }).id;
    await ownerPool.query(
      `insert into shop_framing_option_price (option_id, band, price_pence, is_placeholder)
       values ($1, 'up_to_40x50', 14000, true), ($1, 'up_to_60x80', 22500, true), ($1, 'up_to_80x100', 29500, true)`,
      [optionId],
    );
    const seeded = (await service.list()).items.find((item) => item.id === optionId);
    expect(seeded?.placeholderBands).toHaveLength(3);
    if (!seeded) return;

    const body = {
      name: seeded.name,
      frame: seeded.frame,
      mount: seeded.mount,
      glazing: seeded.glazing,
      hanging: seeded.hanging,
      leadTimeMinDays: seeded.leadTimeMinDays,
      leadTimeMaxDays: seeded.leadTimeMaxDays,
      offered: true,
      expectedVersion: seeded.version,
    };
    // One band changed: the other two are still placeholders, so it cannot be offered.
    const oneBand = { ...seeded.pricesPence, up_to_60x80: 21000 };
    await expect(
      service.update({ ...actor(), optionId, body: { ...body, pricesPence: oneBand } }),
    ).rejects.toThrow(/placeholder price/);
    // The other two confirmed as right: now every band is real.
    const offered = await service.update({
      ...actor(),
      optionId,
      body: {
        ...body,
        pricesPence: oneBand,
        confirmedBands: ["up_to_40x50", "up_to_80x100"],
      },
    });
    expect(offered).toMatchObject({ status: "active", placeholderBands: [] });
    expect(offered.pricesPence).toEqual(oneBand);
  });

  async function shopPoolCheck(id: string) {
    const db = createShopDb(shopPool);
    const [row] = await db
      .select({ status: shopFramingOption.status })
      .from(shopFramingOption)
      .where(eq(shopFramingOption.id, id));
    return row?.status;
  }
});
