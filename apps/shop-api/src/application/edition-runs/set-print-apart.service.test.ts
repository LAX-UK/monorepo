import type { AdminEditionFacts } from "@auction/shop-contracts";
import { ShopDomainError } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import {
  type MemoryPrint,
  createInMemoryEditionRuns,
} from "../../test-support/in-memory-edition-runs.js";
import { editionFactsInput } from "./edition-run-input.js";
import { createEditionRunServices } from "./edition-run-services.js";

const NOW = new Date("2026-11-09T12:00:00.000Z");
const ACTOR = "staff-sara";

const FACTS: AdminEditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "artist",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
  },
};
const REMARQUE = { remarque: { medium: "pencil", place: "lower_margin" } } as const;

let keys = 0;
const staff = () => ({ actorSubjectId: ACTOR, idempotencyKey: `key-${++keys}` });

/** A confirmed LAX standard run "Tide line" with print 23 (LAX's) on sale. */
async function setup(options: { confirmed?: boolean } = {}) {
  const memory = createInMemoryEditionRuns();
  const services = createEditionRunServices({ uow: memory.uow, clock: { now: () => NOW } });
  memory.addArtwork({ artworkId: "run", slug: "tide-line", title: "Tide line" });
  await services.recorder.recordNewRun({} as never, {
    artworkId: "run",
    artistId: "artist-1",
    sourceOriginalArtworkId: null,
    run: { spec: { type: "lax_standard" } },
    actorSubjectId: ACTOR,
  });
  if (options.confirmed !== false) {
    await services.facts.apply(memory.tx, {
      artworkId: "run",
      run: { type: "lax_standard" },
      facts: editionFactsInput(FACTS),
      confirmed: true,
      actorSubjectId: ACTOR,
    });
  }
  const print = (number: number): MemoryPrint => {
    const found = memory.prints.find((row) => row.editionNumber === number);
    if (!found) throw new Error(`no print ${number}`);
    return found;
  };
  print(23).listingStatus = "authorised";
  return { memory, services, print };
}

const command = (editionId: string, differences = REMARQUE as never) => ({
  ...staff(),
  runArtworkId: "run",
  editionId,
  differences,
  printPricePence: 42000,
  canSetPrice: true,
});

describe("setting a print apart", () => {
  it("moves the print to a listing of its own, at its own price", async () => {
    const { memory, services, print } = await setup();
    const result = await services.setApart.setApart(command(print(23).editionId));
    expect(print(23).artworkId).toBe(result.artworkId);
    expect(memory.printsOf("run").some((row) => row.editionNumber === 23)).toBe(false);
    expect(memory.artworks.get(result.artworkId)?.title).toBe(
      "Tide line (no. 23, with a remarque)",
    );
    expect(result.slug).toBe("tide-line-no-23");
    expect(memory.specOf(result.artworkId)).toEqual({
      type: "set_apart",
      mainRunId: "run",
      owner: "lax",
    });
  });

  it("records what differs and who set the print apart", async () => {
    const { memory, services, print } = await setup();
    const result = await services.setApart.setApart(command(print(23).editionId));
    expect(memory.exceptions).toHaveLength(1);
    expect(memory.exceptions[0]).toMatchObject({
      editionId: print(23).editionId,
      runArtworkId: "run",
      listingArtworkId: result.artworkId,
      differences: REMARQUE,
      setApartBySubjectId: ACTOR,
    });
  });

  it("writes the change to the audit log against the run and the listing", async () => {
    const { memory, services, print } = await setup();
    const result = await services.setApart.setApart(command(print(23).editionId));
    const actions = memory.audit.slice(-2);
    expect(actions[0]).toMatchObject({
      action: "set_print_apart",
      targetId: "run",
      afterJson: {
        print: "23",
        listingArtworkId: result.artworkId,
        printPricePence: 42000,
        differences: ["Remarque: an original drawing added by the artist in pencil, lower margin"],
      },
    });
    expect(actions[1]).toMatchObject({
      action: "create_set_apart_listing",
      targetId: result.artworkId,
    });
  });

  it("needs price access, because the listing has its own price", async () => {
    const { services, print } = await setup();
    await expect(
      services.setApart.setApart({ ...command(print(23).editionId), canSetPrice: false }),
    ).rejects.toBeInstanceOf(ShopApiError);
    expect(print(23).artworkId).toBe("run");
  });

  it("waits for the run's facts to be confirmed", async () => {
    const { services, print } = await setup({ confirmed: false });
    await expect(services.setApart.setApart(command(print(23).editionId))).rejects.toThrow(
      "Confirm the run's edition facts",
    );
  });

  it("asks for at least one difference and refuses a signature the run already has", async () => {
    const { services, print } = await setup();
    await expect(
      services.setApart.setApart(command(print(23).editionId, {} as never)),
    ).rejects.toThrow("Say what is different");
    await expect(
      services.setApart.setApart(
        command(print(23).editionId, {
          signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
        } as never),
      ),
    ).rejects.toThrow("Choose a different signature");
  });

  it("refuses a print in a buyer's basket and says until when", async () => {
    const { services, print } = await setup();
    print(23).listingStatus = "reserved";
    print(23).reservedUntil = new Date("2026-11-09T14:32:00.000Z");
    await expect(services.setApart.setApart(command(print(23).editionId))).rejects.toThrow(
      /Print 23 is in a buyer's basket\. It is reserved until 14:32 GMT/,
    );
    expect(print(23).artworkId).toBe("run");
  });

  it("refuses a sold print, a held print and a print nobody can sell", async () => {
    const { services, print } = await setup();
    print(23).listingStatus = "sold";
    await expect(services.setApart.setApart(command(print(23).editionId))).rejects.toThrow(
      "Print 23 is sold",
    );
    print(23).listingStatus = "held";
    await expect(services.setApart.setApart(command(print(23).editionId))).rejects.toThrow(
      "Print 23 is held for a buyer",
    );
    print(23).listingStatus = "authorised";
    await expect(services.setApart.setApart(command(print(3).editionId))).rejects.toThrow(
      "Print 3 is not for sale",
    );
  });

  it("refuses an open edition, which has no print to point at", async () => {
    const memory = createInMemoryEditionRuns();
    const services = createEditionRunServices({ uow: memory.uow, clock: { now: () => NOW } });
    memory.addArtwork({ artworkId: "open" });
    await services.recorder.recordNewRun({} as never, {
      artworkId: "open",
      artistId: "artist-1",
      sourceOriginalArtworkId: null,
      run: { spec: { type: "open", defaultArtistPct: 50 } },
      actorSubjectId: ACTOR,
    });
    await expect(
      services.setApart.setApart({ ...command("none"), runArtworkId: "open" }),
    ).rejects.toThrow(ShopDomainError);
  });

  it("refuses a print that belongs to another run", async () => {
    const { memory, services, print } = await setup();
    memory.addArtwork({ artworkId: "other" });
    await expect(
      services.setApart.setApart({ ...command(print(23).editionId), runArtworkId: "other" }),
    ).rejects.toThrow();
  });
});

describe("returning a print to its run", () => {
  it("puts the print back, retires the listing and closes the record", async () => {
    const { memory, services, print } = await setup();
    const listing = await services.setApart.setApart(command(print(23).editionId));
    await services.setApart.returnToRun({ ...staff(), listingArtworkId: listing.artworkId });
    expect(print(23).artworkId).toBe("run");
    expect(memory.retired.has(listing.artworkId)).toBe(true);
    expect(memory.exceptions[0]?.returnedBy).toBe(ACTOR);
    expect(memory.audit.at(-1)).toMatchObject({
      action: "return_print_to_run",
      targetId: "run",
      afterJson: { print: "23", listingArtworkId: listing.artworkId },
    });
  });

  it("is allowed only while the print is unsold and out of baskets", async () => {
    const { services, print } = await setup();
    const listing = await services.setApart.setApart(command(print(23).editionId));
    print(23).listingStatus = "sold";
    await expect(
      services.setApart.returnToRun({ ...staff(), listingArtworkId: listing.artworkId }),
    ).rejects.toThrow("Print 23 is sold");
    expect(print(23).artworkId).toBe(listing.artworkId);
    print(23).listingStatus = "reserved";
    print(23).reservedUntil = new Date("2026-11-09T13:00:00.000Z");
    await expect(
      services.setApart.returnToRun({ ...staff(), listingArtworkId: listing.artworkId }),
    ).rejects.toThrow("in a buyer's basket");
  });

  it("refuses a listing that is not a print set apart", async () => {
    const { services } = await setup();
    await expect(
      services.setApart.returnToRun({ ...staff(), listingArtworkId: "run" }),
    ).rejects.toThrow("not set apart from a run");
  });

  it("lets the same print be set apart again afterwards, as a new listing", async () => {
    const { services, print } = await setup();
    const first = await services.setApart.setApart(command(print(23).editionId));
    await services.setApart.returnToRun({ ...staff(), listingArtworkId: first.artworkId });
    const second = await services.setApart.setApart(command(print(23).editionId));
    expect(second.artworkId).not.toBe(first.artworkId);
    expect(second.slug).toBe("tide-line-no-23-2");
  });
});
