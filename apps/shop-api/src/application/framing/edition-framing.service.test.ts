import type { AdminEditionFramingSaveBody } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { EditionFramingRejectedError } from "../../errors/edition-framing-rejected-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import {
  BLACK,
  OAK,
  WALNUT,
  createInMemoryEditionFraming,
  liveOption,
} from "../../test-support/in-memory-edition-framing.js";

const ARTWORK = "00000000-0000-4000-8000-0000000000b1";
const catalogue = [
  liveOption(OAK, { name: "Natural oak frame" }),
  liveOption(BLACK, { name: "Black wood frame" }),
  liveOption(WALNUT, { name: "Walnut frame", status: "paused" }),
];

let key = 0;
const command = (body: Partial<AdminEditionFramingSaveBody>, maySetPrices = true) => ({
  artworkId: ARTWORK,
  actorSubjectId: "staff-1",
  idempotencyKey: `key-${++key}`,
  maySetPrices,
  body: {
    mode: "unframed_or_framed" as const,
    framedByArtist: "",
    offers: [],
    expectedVersion: null,
    ...body,
  },
});

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(EditionFramingRejectedError);
  return (error as EditionFramingRejectedError).issues;
}

describe("reading an edition's framing", () => {
  it("lists every catalogue option with its price for the edition's band and whether it is offered", async () => {
    const { service } = createInMemoryEditionFraming({
      catalogue,
      initial: { mode: "unframed_or_framed", offers: [{ optionId: OAK, overridePence: 21000 }] },
    });
    const view = await service.get(ARTWORK);
    expect(view).toMatchObject({
      mode: "unframed_or_framed",
      sheetSize: "50 × 70 cm",
      band: "up_to_60x80",
      version: "2026-11-01T09:00:00.000Z",
    });
    expect(
      view.options.map((o) => [
        o.optionId,
        o.offered,
        o.overridePence,
        o.cataloguePricePence,
        o.offerable,
      ]),
    ).toEqual([
      [OAK, true, 21000, 19500, true],
      [BLACK, false, null, 19500, true],
      [WALNUT, false, null, 19500, false],
    ]);
  });

  it("has no catalogue price while the sheet size has no band", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue, sheetSize: "A2" });
    const view = await service.get(ARTWORK);
    expect(view.band).toBeNull();
    expect(view.options.every((o) => o.cataloguePricePence === null)).toBe(true);
  });

  it("says when the artwork does not exist", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue, known: false });
    await expect(service.get(ARTWORK)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("saving an edition's framing", () => {
  it("saves the offered options with an edition price, and audits before and after", async () => {
    const { service, audit } = createInMemoryEditionFraming({ catalogue });
    const saved = await service.save(
      command({
        offers: [
          { optionId: OAK, overridePence: 21000 },
          { optionId: BLACK, overridePence: null },
        ],
      }),
    );
    expect(
      saved.options.filter((o) => o.offered).map((o) => [o.optionId, o.overridePence]),
    ).toEqual([
      [OAK, 21000],
      [BLACK, null],
    ]);
    expect(audit).toEqual([
      expect.objectContaining({
        capability: "catalogue.write",
        action: "edition_framing.save",
        targetId: ARTWORK,
        beforeJson: { mode: "unframed_or_framed", framedByArtist: "", offers: [] },
        afterJson: expect.objectContaining({
          offers: [
            { optionId: OAK, overridePence: 21000 },
            { optionId: BLACK, overridePence: null },
          ],
        }),
      }),
    ]);
  });

  it("refuses a new offer of an option buyers cannot be shown", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue });
    const issues = await issuesOf(
      service.save(command({ offers: [{ optionId: WALNUT, overridePence: null }] })),
    );
    expect(issues).toEqual([{ field: `option:${WALNUT}`, reason: "option_not_offerable" }]);
  });

  it("lets an offer already saved stay while its option is paused", async () => {
    const { service } = createInMemoryEditionFraming({
      catalogue,
      initial: { mode: "unframed_or_framed", offers: [{ optionId: WALNUT, overridePence: null }] },
    });
    const saved = await service.save(
      command({
        offers: [
          { optionId: WALNUT, overridePence: null },
          { optionId: OAK, overridePence: null },
        ],
        expectedVersion: "2026-11-01T09:00:00.000Z",
      }),
    );
    expect(saved.options.filter((o) => o.offered)).toHaveLength(2);
  });

  it("needs a known size band to offer anything", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue, sheetSize: null });
    const issues = await issuesOf(
      service.save(command({ offers: [{ optionId: OAK, overridePence: null }] })),
    );
    expect(issues).toEqual([{ field: "offers", reason: "no_size_band" }]);
  });

  it("needs an option buyers can choose when sold framed only", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue });
    const issues = await issuesOf(service.save(command({ mode: "framed_only" })));
    expect(issues).toEqual([{ field: "offers", reason: "framed_only_needs_option" }]);
  });

  it("keeps the artist's frame in words for a print that comes framed, with no options", async () => {
    const { service } = createInMemoryEditionFraming({
      catalogue,
      initial: { mode: "unframed_or_framed", offers: [{ optionId: OAK, overridePence: null }] },
    });
    const saved = await service.save(
      command({
        mode: "framed_by_artist",
        framedByArtist: "  Oak frame made by the artist  ",
        offers: [],
        expectedVersion: "2026-11-01T09:00:00.000Z",
      }),
    );
    expect(saved).toMatchObject({
      mode: "framed_by_artist",
      framedByArtist: "Oak frame made by the artist",
    });
    expect(saved.options.some((o) => o.offered)).toBe(false);
  });

  it("asks for the artist's frame to be described", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue });
    const issues = await issuesOf(service.save(command({ mode: "framed_by_artist" })));
    expect(issues).toEqual([{ field: "framedByArtist", reason: "description_required" }]);
  });

  it("refuses an edition price from staff who may not set prices, and saves nothing", async () => {
    const { service, audit } = createInMemoryEditionFraming({ catalogue });
    await expect(
      service.save(command({ offers: [{ optionId: OAK, overridePence: 21000 }] }, false)),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(audit).toEqual([]);
  });

  it("lets staff without the price permission save options at the catalogue price", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue });
    const saved = await service.save(
      command({ offers: [{ optionId: OAK, overridePence: null }] }, false),
    );
    expect(saved.options.find((o) => o.optionId === OAK)?.offered).toBe(true);
  });

  it("lets staff without the price permission leave a saved edition price as it is", async () => {
    const { service } = createInMemoryEditionFraming({
      catalogue,
      initial: { mode: "unframed_or_framed", offers: [{ optionId: OAK, overridePence: 21000 }] },
    });
    const saved = await service.save(
      command(
        {
          offers: [{ optionId: OAK, overridePence: 21000 }],
          expectedVersion: "2026-11-01T09:00:00.000Z",
        },
        false,
      ),
    );
    expect(saved.options.find((o) => o.optionId === OAK)?.overridePence).toBe(21000);
  });

  it("refuses a save made from an older version", async () => {
    const { service } = createInMemoryEditionFraming({
      catalogue,
      initial: { mode: "unframed_or_framed", offers: [] },
    });
    await expect(
      service.save(command({ expectedVersion: "2026-10-01T00:00:00.000Z" })),
    ).rejects.toBeInstanceOf(StaleVersionError);
  });

  it("refuses a first save that thinks it is editing saved settings", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue });
    await expect(
      service.save(command({ expectedVersion: "2026-10-01T00:00:00.000Z" })),
    ).rejects.toBeInstanceOf(StaleVersionError);
  });

  it("refuses an option that is not in the catalogue", async () => {
    const { service } = createInMemoryEditionFraming({ catalogue });
    const unknown = "00000000-0000-4000-8000-0000000000ff";
    const issues = await issuesOf(
      service.save(command({ offers: [{ optionId: unknown, overridePence: null }] })),
    );
    expect(issues).toContainEqual({ field: `option:${unknown}`, reason: "option_not_offerable" });
  });

  it("replays a repeated key without saving twice", async () => {
    const { service, audit } = createInMemoryEditionFraming({ catalogue });
    const same = command({ offers: [{ optionId: OAK, overridePence: null }] });
    const first = await service.save(same);
    const again = await service.save(same);
    expect(again).toEqual(first);
    expect(audit).toHaveLength(1);
  });
});
