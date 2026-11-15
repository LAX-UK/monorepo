import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const reads = vi.hoisted(() => ({
  lot: vi.fn(),
  withdrawn: vi.fn(),
  sale: vi.fn(),
  artist: vi.fn(),
  staffLot: vi.fn(),
  staffSale: vi.fn(),
  staffReads: vi.fn(),
}));
vi.mock("@/lib/data/http/public-catalogue.server", () => ({
  getPublicLotById: reads.lot,
  getPublicSaleShell: reads.sale,
}));
vi.mock("@/lib/marketing/staff-catalogue-preview.server", () => ({
  staffPreviewLot: reads.staffLot,
  staffPreviewSaleReads: reads.staffReads,
}));
vi.mock("@/lib/lot-page/load-withdrawn-lot.server", () => ({
  withdrawnLotPageExists: reads.withdrawn,
}));
vi.mock("@/lib/data/http/artist.server", () => ({ registryArtistPageExists: reads.artist }));

import {
  requireArtistPage,
  requireLotPage,
  requireSalePage,
} from "@/lib/marketing/detail-page-existence";

/** What `notFound()` throws: the digest Next.js turns into a 404 status. */
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
const outage = new Error("Failed to load: 503");

beforeEach(() => {
  reads.lot.mockReset().mockResolvedValue(null);
  reads.withdrawn.mockReset().mockResolvedValue("missing");
  reads.sale.mockReset().mockResolvedValue(null);
  reads.artist.mockReset().mockResolvedValue("missing");
  reads.staffLot.mockReset().mockResolvedValue(null);
  reads.staffSale.mockReset().mockResolvedValue(null);
  reads.staffReads.mockReset().mockResolvedValue(null);
});

/** A failure must surface as the original error, never as the 404 digest. */
async function expectOutage(run: Promise<unknown>) {
  const error = await run.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBe(outage);
  expect(error).not.toMatchObject(NOT_FOUND);
}

describe("requireLotPage", () => {
  it("is a 404 for a lot the API says does not exist", async () => {
    await expect(requireLotPage("missing")).rejects.toMatchObject(NOT_FOUND);
  });

  it("throws, not 404, when the lot read fails", async () => {
    reads.lot.mockRejectedValue(outage);
    await expectOutage(requireLotPage("lot-1"));
  });

  it("throws, not 404, when the withdrawn-lot read fails", async () => {
    reads.withdrawn.mockRejectedValue(outage);
    await expectOutage(requireLotPage("lot-1"));
  });

  it("lets a lot the viewer may see through", async () => {
    reads.lot.mockResolvedValue({ id: "lot-1" });
    await expect(requireLotPage("lot-1")).resolves.toBeUndefined();
    expect(reads.withdrawn).not.toHaveBeenCalled();
  });

  it("lets a withdrawn lot through, because it keeps its page", async () => {
    reads.withdrawn.mockResolvedValue("exists");
    await expect(requireLotPage("lot-1")).resolves.toBeUndefined();
  });

  it("asks for the session only when the public read found nothing", async () => {
    reads.lot.mockResolvedValue({ id: "lot-1" });
    await requireLotPage("lot-1");
    expect(reads.staffLot).not.toHaveBeenCalled();

    reads.lot.mockResolvedValue(null);
    reads.staffLot.mockResolvedValue({ id: "draft" });
    await expect(requireLotPage("draft")).resolves.toBeUndefined();
  });
});

describe("requireSalePage", () => {
  it("is a 404 for a sale that does not exist, or is hidden or test for the public", async () => {
    await expect(requireSalePage("missing")).rejects.toMatchObject(NOT_FOUND);
  });

  it("throws, not 404, when the sale read fails", async () => {
    reads.sale.mockRejectedValue(outage);
    await expectOutage(requireSalePage("s1"));
  });

  it("lets a sale through without reading the session", async () => {
    reads.sale.mockResolvedValue({ sale: { id: "s1" } });
    await expect(requireSalePage("s1")).resolves.toBeUndefined();
    expect(reads.staffReads).not.toHaveBeenCalled();
  });

  it("lets staff preview a sale the public cannot see", async () => {
    reads.staffReads.mockResolvedValue({ shell: reads.staffSale, lotsPage: vi.fn() });
    reads.staffSale.mockResolvedValue({ sale: { id: "draft" } });
    await expect(requireSalePage("draft")).resolves.toBeUndefined();
  });
});

describe("requireArtistPage", () => {
  it("is a 404 for an artist that does not exist", async () => {
    await expect(requireArtistPage("missing")).rejects.toMatchObject(NOT_FOUND);
  });

  it("throws, not 404, when the artist read fails", async () => {
    reads.artist.mockRejectedValue(outage);
    await expectOutage(requireArtistPage("a1"));
  });

  it("lets an artist through", async () => {
    reads.artist.mockResolvedValue("exists");
    await expect(requireArtistPage("a1")).resolves.toBeUndefined();
  });
});
