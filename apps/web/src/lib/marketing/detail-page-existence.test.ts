import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const reads = vi.hoisted(() => ({
  lot: vi.fn(),
  withdrawn: vi.fn(),
  sale: vi.fn(),
  artist: vi.fn(),
}));
vi.mock("@/lib/data/http/lots.server", () => ({ getServerLotById: reads.lot }));
vi.mock("@/lib/lot-page/load-withdrawn-lot.server", () => ({
  withdrawnLotPageExists: reads.withdrawn,
}));
vi.mock("@/lib/data/http/sales.server", () => ({ getServerSaleShell: reads.sale }));
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
});

describe("requireSalePage", () => {
  it("is a 404 for a sale that does not exist, or is hidden or test for the public", async () => {
    await expect(requireSalePage("missing")).rejects.toMatchObject(NOT_FOUND);
  });

  it("throws, not 404, when the sale read fails", async () => {
    reads.sale.mockRejectedValue(outage);
    await expectOutage(requireSalePage("s1"));
  });

  it("lets a sale through", async () => {
    reads.sale.mockResolvedValue({ sale: { id: "s1" } });
    await expect(requireSalePage("s1")).resolves.toBeUndefined();
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
