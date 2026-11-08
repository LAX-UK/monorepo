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
      pricesPlaceholder: false,
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

  it("keeps the prices placeholders while none of them changes", async () => {
    const { service, stored } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const saved = await service.update(
      edit(current, { pricesPence: OAK_PRICES, name: "Oak frame, renamed" }),
    );
    expect(saved).toMatchObject({ name: "Oak frame, renamed", pricesPlaceholder: true });
    expect(stored.get(OAK)?.status).toBe("draft");
  });

  it("makes the prices real once one of them changes", async () => {
    const { service } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const saved = await service.update(
      edit(current, { pricesPence: { ...OAK_PRICES, up_to_60x80: 21000 } }),
    );
    expect(saved.pricesPlaceholder).toBe(false);
    expect(saved.pricesPence.up_to_60x80).toBe(21000);
  });

  it("refuses to offer placeholder prices, against the Offered switch", async () => {
    const { service, stored } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const issues = await issuesOf(
      service.update(edit(current, { pricesPence: OAK_PRICES, offered: true })),
    );
    expect(issues).toEqual([{ field: "offered", reason: "placeholder_prices" }]);
    expect(stored.get(OAK)?.status).toBe("draft");
  });

  it("offers an option whose prices were changed in the same save", async () => {
    const { service } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const saved = await service.update(
      edit(current, { pricesPence: { ...OAK_PRICES, up_to_40x50: 13500 }, offered: true }),
    );
    expect(saved).toMatchObject({ status: "active", pricesPlaceholder: false });
  });

  it("pauses an active option when Offered is turned off", async () => {
    const { service } = seeded({ status: "active", pricesPlaceholder: false });
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
      beforeJson: { pricesPlaceholder: true },
      afterJson: { pricesPlaceholder: false },
    });
  });
});

describe("offering and pausing an option", () => {
  it("pauses an active option and audits the change", async () => {
    const { service, audit } = seeded({ status: "active", pricesPlaceholder: false });
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
    const { service } = seeded({ status: "paused", pricesPlaceholder: false });
    const current = (await service.list()).items[0] as { version: string };
    const offered = await service.offer({
      ...withKey(),
      optionId: OAK,
      body: { offered: true, expectedVersion: current.version },
    });
    expect(offered.status).toBe("active");
  });

  it("will not offer an option whose prices are still placeholders", async () => {
    const { service, stored } = seeded();
    const current = (await service.list()).items[0] as { version: string };
    const issues = await issuesOf(
      service.offer({
        ...withKey(),
        optionId: OAK,
        body: { offered: true, expectedVersion: current.version },
      }),
    );
    expect(issues).toEqual([{ field: "offered", reason: "placeholder_prices" }]);
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
