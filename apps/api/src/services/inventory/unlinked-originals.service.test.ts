import type { UnlinkedOriginalsReport } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import {
  UNLINKED_ORIGINALS_LISTED_PER_PRODUCT,
  UnlinkedOriginalsService,
} from "./unlinked-originals.service.js";

const report: UnlinkedOriginalsReport = {
  counts: { bid: 2, laxArt: 1 },
  items: [
    { product: "bid", id: "lot-1", title: "Harbour", artistName: null, state: "Live" },
    {
      product: "lax_art",
      id: "art-1",
      title: "Dusk",
      artistName: "Aidan Phelan",
      state: "Published",
    },
  ],
};

function setup(blocking = false) {
  const originals = { listLiveUnlinkedOriginals: vi.fn().mockResolvedValue(report) };
  const settings = {
    blockUnlinkedPublish: vi.fn().mockResolvedValue(blocking),
    setBlockUnlinkedPublish: vi.fn().mockResolvedValue(undefined),
  };
  return { service: new UnlinkedOriginalsService({ originals, settings }), originals, settings };
}

describe("UnlinkedOriginalsService", () => {
  it("shows the report with the switch off by default", async () => {
    const { service, originals } = setup();
    await expect(service.view()).resolves.toEqual({ blockPublishing: false, ...report });
    expect(originals.listLiveUnlinkedOriginals).toHaveBeenCalledWith(
      UNLINKED_ORIGINALS_LISTED_PER_PRODUCT,
    );
  });

  it("shows the switch on once staff turned it on", async () => {
    const { service } = setup(true);
    expect((await service.view()).blockPublishing).toBe(true);
  });

  it("records who changed the switch and answers with its new state", async () => {
    const { service, settings } = setup();
    await expect(service.setBlockPublishing(true, "usr_1")).resolves.toEqual({
      blockPublishing: true,
    });
    expect(settings.setBlockUnlinkedPublish).toHaveBeenCalledWith(true, "usr_1");
  });
});
