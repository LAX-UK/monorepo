import { describe, expect, it, vi } from "vitest";
import { createFakeObjectStorage } from "../../test-support/fake-object-storage.js";
import { createMemoryShopMediaAssetRepository } from "../../test-support/memory-shop-media-asset.repository.js";
import type { ImageProbePort } from "../ports/image-probe.port.js";
import { createLegacyMediaImporter, legacyMediaKey } from "./legacy-media-importer.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]);
const HTML = Buffer.from("<html>not an image</html>");

const probe: ImageProbePort = {
  analyze: async () => ({ width: 800, height: 600 }),
  makeLqip: async () => "data:image/webp;base64,abc",
};

function setup(responses: Record<string, Buffer | null>) {
  const storage = createFakeObjectStorage();
  const assets = createMemoryShopMediaAssetRepository();
  const fetcher = { fetch: vi.fn(async (url: string) => responses[url] ?? null) };
  const media = createLegacyMediaImporter({
    fetcher,
    storage,
    assets,
    imageProbe: probe,
    actor: "legacy-thelax-import",
  });
  return { storage, assets, fetcher, media };
}

describe("createLegacyMediaImporter", () => {
  const url = "https://www.thelax.art/uds/stock/m/1.jpg";

  it("uploads once under a deterministic key and records the public URL", async () => {
    const { storage, assets, fetcher, media } = setup({ [url]: JPEG });
    const [first, again] = await Promise.all([
      media.importImage(url, "artwork_image", "Alt"),
      media.importImage(url, "artwork_image", "Alt"),
    ]);
    const key = legacyMediaKey("artwork_image", url, "image/jpeg");
    expect(first).toBe(key);
    expect(again).toBe(key);
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(storage.objects.get(key)?.contentType).toBe("image/jpeg");
    expect((await assets.findByKey(key))?.status).toBe("active");
    expect(media.publicUrls().get("/uds/stock/m/1.jpg")).toBe(`https://cdn.test/${key}`);
  });

  it("reuses an asset already active from a previous run without refetching", async () => {
    const first = setup({ [url]: JPEG });
    await first.media.importImage(url, "artwork_image", null);
    const rerun = createLegacyMediaImporter({
      fetcher: first.fetcher,
      storage: first.storage,
      assets: first.assets,
      imageProbe: probe,
      actor: "legacy-thelax-import",
    });
    await rerun.importImage(url, "artwork_image", null);
    expect(first.fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(rerun.stats()).toMatchObject({ imported: 0, reused: 1 });
  });

  it("rejects missing, non-image and unsupported-extension sources", async () => {
    const bad = "https://www.thelax.art/uds/stock/m/2.jpg";
    const { media, storage } = setup({ [bad]: HTML });
    expect(await media.importImage(bad, "artwork_image", null)).toBeNull();
    expect(
      await media.importImage("https://www.thelax.art/uds/3.jpg", "artwork_image", null),
    ).toBeNull();
    expect(
      await media.importImage("https://www.thelax.art/uds/4.gif", "artwork_image", null),
    ).toBeNull();
    expect(storage.objects.size).toBe(0);
    expect(media.stats().failed).toHaveLength(3);
  });
});
