import type { FramingOptionBody } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { FramingRejectedError } from "../../errors/framing-rejected-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import {
  OAK_PRICES,
  createInMemoryFraming,
  seededOption,
} from "../../test-support/in-memory-framing.js";
import type { StoredFramingOption } from "./framing.ports.js";

const OAK = "00000000-0000-4000-8000-0000000000a1";
const actor = { actorSubjectId: "staff-1" };

const body: FramingOptionBody = {
  name: "Walnut frame",
  frame: "natural_oak",
  mount: "window_conservation",
  glazing: "uv_acrylic",
  hanging: "d_rings_cord",
  leadTimeMinDays: 15,
  leadTimeMaxDays: 20,
  pricesPence: { up_to_40x50: 16000, up_to_60x80: 25000, up_to_80x100: 32500 },
  offered: false,
};

let key = 0;
const withKey = () => ({ ...actor, idempotencyKey: `key-${++key}` });

function seeded(overrides: Partial<StoredFramingOption> = {}) {
  return createInMemoryFraming({ options: [seededOption({ id: OAK, ...overrides })] });
}

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(FramingRejectedError);
  return (error as FramingRejectedError).issues;
}

describe("creating a framing option", () => {
  it("adds it as a draft with a code from its name, and audits it", async () => {
    const { service, audit } = createInMemoryFraming();
    const created = await service.create({ ...withKey(), body });
    expect(created).toMatchObject({
      code: "walnut-frame",
      name: "Walnut frame",
      status: "draft",
      placeholderBands: [],
      editionCount: 0,
    });
    expect(audit).toEqual([
      expect.objectContaining({
        capability: "catalogue.write",
        action: "framing.create",
        targetType: "shop_framing_option",
        targetId: created.id,
      }),
    ]);
  });

  it("offers it at once when asked, since the prices are the staff's own", async () => {
    const { service } = createInMemoryFraming();
    const created = await service.create({ ...withKey(), body: { ...body, offered: true } });
    expect(created.status).toBe("active");
  });

  it("gives a second option with the same name its own code", async () => {
    const { service } = createInMemoryFraming();
    await service.create({ ...withKey(), body });
    const second = await service.create({ ...withKey(), body });
    expect(second.code).toBe("walnut-frame-2");
  });

  it("names every field at fault and saves nothing", async () => {
    const { service, stored } = createInMemoryFraming();
    const issues = await issuesOf(
      service.create({
        ...withKey(),
        body: {
          ...body,
          name: " ",
          leadTimeMaxDays: null,
          pricesPence: { up_to_40x50: 16000, up_to_60x80: null, up_to_80x100: 32500 },
        },
      }),
    );
    expect(issues).toEqual([
      { field: "name", reason: "name_required" },
      { field: "leadTimeMaxDays", reason: "lead_time_max_invalid" },
      { field: "price:up_to_60x80", reason: "price_missing" },
    ]);
    expect(stored.size).toBe(0);
  });

  it("replays a repeated key without adding a second option", async () => {
    const { service, stored } = createInMemoryFraming();
    const command = { ...withKey(), body };
    const first = await service.create(command);
    const again = await service.create(command);
    expect(again).toEqual(first);
    expect(stored.size).toBe(1);
  });
});

describe("editing a framing option", () => {
  const edit = (current: { version: string }, changes: Partial<FramingOptionBody>) => ({
    ...withKey(),
    optionId: OAK,
    body: { ...body, name: "Natural oak frame", ...changes, expectedVersion: current.version },
  });

  it("keeps every band a placeholder while none of its prices changes", async () => {
    const { service, stored } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const saved = await service.update(
      edit(current, { pricesPence: OAK_PRICES, name: "Oak frame, renamed" }),
    );
    expect(saved).toMatchObject({
      name: "Oak frame, renamed",
      placeholderBands: ["up_to_40x50", "up_to_60x80", "up_to_80x100"],
    });
    expect(stored.get(OAK)?.status).toBe("draft");
  });

  it("makes only the band that changed real", async () => {
    const { service } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const saved = await service.update(
      edit(current, { pricesPence: { ...OAK_PRICES, up_to_60x80: 21000 } }),
    );
    expect(saved.pricesPence.up_to_60x80).toBe(21000);
    expect(saved.placeholderBands).toEqual(["up_to_40x50", "up_to_80x100"]);
  });

  it("will not offer an option when only one band has been changed, and names the others", async () => {
    const { service, stored } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const issues = await issuesOf(
      service.update(
        edit(current, { pricesPence: { ...OAK_PRICES, up_to_60x80: 21000 }, offered: true }),
      ),
    );
    expect(issues).toEqual([
      { field: "price:up_to_40x50", reason: "placeholder_price" },
      { field: "price:up_to_80x100", reason: "placeholder_price" },
    ]);
    expect(stored.get(OAK)?.status).toBe("draft");
    expect(stored.get(OAK)?.placeholderBands).toHaveLength(3);
  });

  it("offers an option once every band is changed or confirmed", async () => {
    const { service } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const saved = await service.update(
      edit(current, {
        pricesPence: { ...OAK_PRICES, up_to_40x50: 13500 },
        confirmedBands: ["up_to_60x80", "up_to_80x100"],
        offered: true,
      }),
    );
    expect(saved).toMatchObject({ status: "active", placeholderBands: [] });
    expect(saved.pricesPence).toEqual({ ...OAK_PRICES, up_to_40x50: 13500 });
  });

  it("lets staff confirm a price that already equals the placeholder", async () => {
    const { service } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const saved = await service.update(
      edit(current, { pricesPence: OAK_PRICES, confirmedBands: ["up_to_60x80"] }),
    );
    expect(saved.placeholderBands).toEqual(["up_to_40x50", "up_to_80x100"]);
    expect(saved.pricesPence.up_to_60x80).toBe(OAK_PRICES.up_to_60x80);
  });

  it("remembers a confirmed band on a later save", async () => {
    const { service } = seeded();
    const first = await service.update(
      edit((await service.list()).items[0] as { version: string }, {
        pricesPence: OAK_PRICES,
        confirmedBands: ["up_to_60x80"],
      }),
    );
    const second = await service.update(
      edit(first, { pricesPence: OAK_PRICES, name: "Natural oak frame" }),
    );
    expect(second.placeholderBands).toEqual(["up_to_40x50", "up_to_80x100"]);
  });

  it("pauses an active option when Offered is turned off", async () => {
    const { service } = seeded({ status: "active", placeholderBands: [] });
    const current = (await service.list()).items[0] as { version: string };
    const saved = await service.update(edit(current, { pricesPence: OAK_PRICES, offered: false }));
    expect(saved.status).toBe("paused");
  });

  it("refuses a save made from an older version", async () => {
    const { service, audit } = seeded();
    const stale = { version: "2026-10-01T00:00:00.000Z" };
    await expect(service.update(edit(stale, {}))).rejects.toBeInstanceOf(StaleVersionError);
    expect(audit).toEqual([]);
  });

  it("says when the option does not exist", async () => {
    const { service } = createInMemoryFraming();
    await expect(
      service.update({
        ...withKey(),
        optionId: OAK,
        body: { ...body, expectedVersion: "2026-11-01T09:00:00.000Z" },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("audits the option before and after", async () => {
    const { service, audit } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    await service.update(edit(current, { pricesPence: { ...OAK_PRICES, up_to_60x80: 21000 } }));
    expect(audit[0]).toMatchObject({
      action: "framing.update",
      targetId: OAK,
      beforeJson: { placeholderBands: ["up_to_40x50", "up_to_60x80", "up_to_80x100"] },
      afterJson: { placeholderBands: ["up_to_40x50", "up_to_80x100"] },
    });
  });

  it("records the bands staff confirmed in the save, and none when there were none", async () => {
    const { service, audit } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const first = await service.update(
      edit(current, { pricesPence: OAK_PRICES, confirmedBands: ["up_to_60x80"] }),
    );
    expect(audit[0]?.afterJson).toMatchObject({ confirmedBands: ["up_to_60x80"] });
    await service.update(edit(first, { pricesPence: OAK_PRICES, name: "Natural oak frame" }));
    expect(audit[1]?.afterJson).toMatchObject({ confirmedBands: [] });
  });
});

describe("offering and pausing an option", () => {
  it("pauses an active option and audits the change", async () => {
    const { service, audit } = seeded({ status: "active", placeholderBands: [] });
    const current = (await service.list()).items[0] as { version: string };
    const paused = await service.offer({
      ...withKey(),
      optionId: OAK,
      body: { offered: false, expectedVersion: current.version },
    });
    expect(paused.status).toBe("paused");
    expect(audit[0]).toMatchObject({
      action: "framing.pause",
      beforeJson: { status: "active" },
      afterJson: { status: "paused" },
    });
  });

  it("offers a paused option again", async () => {
    const { service } = seeded({ status: "paused", placeholderBands: [] });
    const current = (await service.list()).items[0] as { version: string };
    const offered = await service.offer({
      ...withKey(),
      optionId: OAK,
      body: { offered: true, expectedVersion: current.version },
    });
    expect(offered.status).toBe("active");
  });

  it("will not offer an option while any price is a placeholder", async () => {
    const { service, stored } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const issues = await issuesOf(
      service.offer({
        ...withKey(),
        optionId: OAK,
        body: { offered: true, expectedVersion: current.version },
      }),
    );
    expect(issues).toEqual([
      { field: "price:up_to_40x50", reason: "placeholder_price" },
      { field: "price:up_to_60x80", reason: "placeholder_price" },
      { field: "price:up_to_80x100", reason: "placeholder_price" },
    ]);
    expect(stored.get(OAK)?.status).toBe("draft");
  });

  it("keeps a draft a draft when it is switched off", async () => {
    const { service } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const result = await service.offer({
      ...withKey(),
      optionId: OAK,
      body: { offered: false, expectedVersion: current.version },
    });
    expect(result.status).toBe("draft");
  });
});

describe("listing the catalogue", () => {
  it("counts the editions offering each option", async () => {
    const { service } = createInMemoryFraming({
      options: [seededOption({ id: OAK })],
      editions: { [OAK]: 3 },
    });
    expect((await service.list()).items[0]?.editionCount).toBe(3);
  });
});
