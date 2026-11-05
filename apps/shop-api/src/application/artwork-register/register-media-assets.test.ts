import { describe, expect, it, vi } from "vitest";
import { registerMissingMediaAssets } from "./register-media-assets.js";

function setup(keys: string[], files: Record<string, Buffer | null>) {
  const store = {
    findUnregisteredKeys: vi.fn(async () => keys),
    insertActive: vi.fn(async () => undefined),
  };
  const storage = {
    headObject: vi.fn(async (key: string) =>
      files[key]
        ? { contentType: "image/jpeg", byteSize: files[key]?.byteLength ?? 0, etag: "e" }
        : null,
    ),
    getObjectBytes: vi.fn(async (key: string) => files[key] ?? null),
  };
  const probe = {
    analyze: vi.fn(async () => ({ width: 800, height: 600 })),
    makeLqip: vi.fn(async () => "data:image/webp;base64,AAAA"),
  };
  const onSkipped = vi.fn();
  return { store, storage, probe, onSkipped };
}

describe("registerMissingMediaAssets", () => {
  it("records size, type and a blurred placeholder for each stored picture", async () => {
    const t = setup(["shop/artwork/zoho-a.jpg"], { "shop/artwork/zoho-a.jpg": Buffer.from("img") });
    expect(await registerMissingMediaAssets(t)).toBe(1);
    expect(t.store.insertActive).toHaveBeenCalledWith({
      key: "shop/artwork/zoho-a.jpg",
      contentType: "image/jpeg",
      byteSize: 3,
      width: 800,
      height: 600,
      blurDataUrl: "data:image/webp;base64,AAAA",
    });
  });

  it("does nothing when every picture is already recorded", async () => {
    const t = setup([], {});
    expect(await registerMissingMediaAssets(t)).toBe(0);
    expect(t.storage.headObject).not.toHaveBeenCalled();
  });

  it("skips a picture not in storage yet and carries on with the others", async () => {
    const t = setup(["missing.jpg", "ok.jpg"], { "missing.jpg": null, "ok.jpg": Buffer.from("x") });
    expect(await registerMissingMediaAssets(t)).toBe(1);
    expect(t.onSkipped).toHaveBeenCalledWith("missing.jpg", "not_in_storage");
  });

  it("skips a picture it cannot measure, leaving it for the next pass", async () => {
    const t = setup(["bad.jpg", "ok.jpg"], {
      "bad.jpg": Buffer.from("x"),
      "ok.jpg": Buffer.from("y"),
    });
    t.probe.analyze.mockRejectedValueOnce(new Error("image_missing_dimensions"));
    expect(await registerMissingMediaAssets(t)).toBe(1);
    expect(t.onSkipped).toHaveBeenCalledWith("bad.jpg", "failed");
    expect(t.store.insertActive).toHaveBeenCalledTimes(1);
  });
});
