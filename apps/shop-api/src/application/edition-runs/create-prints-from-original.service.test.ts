import { ShopDomainError } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { createInMemoryEditionRuns } from "../../test-support/in-memory-edition-runs.js";
import { createEditionRunServices } from "./edition-run-services.js";

const NOW = new Date("2026-11-03T09:00:00.000Z");
const ACTOR = "staff-sara";
const STANDARD = { spec: { type: "lax_standard" as const } };

let keys = 0;
const staff = () => ({ actorSubjectId: ACTOR, idempotencyKey: `key-${++keys}` });

function setup() {
  const memory = createInMemoryEditionRuns();
  const services = createEditionRunServices({ uow: memory.uow, clock: { now: () => NOW } });
  memory.addArtwork({
    artworkId: "original",
    slug: "harbour-at-dusk",
    title: "Harbour at dusk",
    sellsPrints: false,
  });
  return { memory, prints: services.printsFromOriginal };
}

describe("CreatePrintsFromOriginal", () => {
  it("creates a draft linked to the original, with the run's prints and stock references", async () => {
    const { memory, prints } = setup();
    const result = await prints.create({
      ...staff(),
      originalArtworkId: "original",
      title: "Harbour at dusk",
      run: STANDARD,
    });

    expect(result.editionCount).toBe(24);
    expect(result.slug).toBe("harbour-at-dusk-prints");
    const listing = memory.artworks.get(result.artworkId);
    expect(listing?.sourceOriginalArtworkId).toBe("original");
    expect(listing?.sellsPrints).toBe(true);
    expect(memory.specOf(result.artworkId)).toEqual({ type: "lax_standard" });
    const made = memory.printsOf(result.artworkId);
    expect(made.map((print) => print.stockRef)).toEqual(
      Array.from({ length: 24 }, (_, i) => i + 1),
    );
    expect(made.filter((print) => print.allocation === "original_buyer_entitlement")).toHaveLength(
      10,
    );
    expect(memory.audit.map((record) => record.action)).toContain("create_prints_from_original");
  });

  it("emits the events the separate creates would: the artwork, then its editions", async () => {
    const { memory, prints } = setup();
    const result = await prints.create({
      ...staff(),
      originalArtworkId: "original",
      title: "Harbour at dusk",
      run: STANDARD,
    });
    expect(memory.events.map((event) => [event.eventType, event.aggregateId])).toEqual([
      ["shop.artwork.created", result.artworkId],
      ["shop.editions.allocated", result.artworkId],
    ]);
    expect(memory.events[1]?.payload).toMatchObject({ editionCount: 24 });
    expect(memory.events[0]?.payload.importKey).toBe(memory.events[1]?.payload.importKey);
  });

  it("uses the Shop title staff typed, trimmed", async () => {
    const { memory, prints } = setup();
    const result = await prints.create({
      ...staff(),
      originalArtworkId: "original",
      title: "  Harbour at dusk, signed prints ",
      run: STANDARD,
    });
    expect(memory.artworks.get(result.artworkId)?.title).toBe("Harbour at dusk, signed prints");
  });

  it("allows a second set for the same original, on the next free web address", async () => {
    const { prints } = setup();
    const input = { originalArtworkId: "original", title: "Harbour at dusk", run: STANDARD };
    const first = await prints.create({ ...staff(), ...input });
    const second = await prints.create({ ...staff(), ...input });
    expect(first.slug).toBe("harbour-at-dusk-prints");
    expect(second.slug).toBe("harbour-at-dusk-prints-2");
  });

  it("lets a custom run give prints to the original's buyer, because it is linked", async () => {
    const { memory, prints } = setup();
    const result = await prints.create({
      ...staff(),
      originalArtworkId: "original",
      title: "Harbour at dusk",
      run: {
        spec: { type: "custom_limited", size: 30, allocation: { buyer: 5, artist: 15, lax: 10 } },
      },
    });
    expect(result.editionCount).toBe(30);
    expect(
      memory
        .printsOf(result.artworkId)
        .filter((print) => print.allocation === "original_buyer_entitlement"),
    ).toHaveLength(5);
  });

  it("refuses an archived original", async () => {
    const { memory, prints } = setup();
    memory.addArtwork({ artworkId: "old", sellsPrints: false, archived: true });
    await expect(
      prints.create({ ...staff(), originalArtworkId: "old", title: "Old", run: STANDARD }),
    ).rejects.toThrow(ShopDomainError);
    expect(memory.printsOf("old")).toHaveLength(0);
    expect(memory.events).toHaveLength(0);
  });

  it("refuses an edition, which is not an original", async () => {
    const { memory, prints } = setup();
    memory.addArtwork({ artworkId: "edition", sellsPrints: true });
    await expect(
      prints.create({ ...staff(), originalArtworkId: "edition", title: "x", run: STANDARD }),
    ).rejects.toThrow("not another edition");
  });

  it("answers not found for an artwork that does not exist", async () => {
    const { prints } = setup();
    await expect(
      prints.create({ ...staff(), originalArtworkId: "missing", title: "x", run: STANDARD }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses a blank title before creating anything", async () => {
    const { memory, prints } = setup();
    await expect(
      prints.create({ ...staff(), originalArtworkId: "original", title: "   ", run: STANDARD }),
    ).rejects.toBeInstanceOf(ShopApiError);
    expect(memory.events).toHaveLength(0);
  });

  it("records an open edition with no first batch as a listing with no prints yet", async () => {
    const { memory, prints } = setup();
    const result = await prints.create({
      ...staff(),
      originalArtworkId: "original",
      title: "Harbour at dusk",
      run: { spec: { type: "open", defaultArtistPct: 50 } },
    });
    expect(result.editionCount).toBe(0);
    expect(memory.events.map((event) => event.eventType)).toEqual(["shop.artwork.created"]);
  });
});
