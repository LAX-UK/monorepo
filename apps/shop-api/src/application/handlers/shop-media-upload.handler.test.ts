import { describe, expect, it } from "vitest";
import { createFakeObjectStorage } from "../../test-support/fake-object-storage.js";
import { createMemoryShopMediaAssetRepository } from "../../test-support/memory-shop-media-asset.repository.js";
import type { ImageProbePort } from "../ports/image-probe.port.js";
import { createShopMediaUploadHandlers } from "./shop-media-upload.handler.js";

const probe: ImageProbePort = {
  async analyze() {
    return { width: 800, height: 600 };
  },
  async makeLqip() {
    return "data:image/webp;base64,abc";
  },
};

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

describe("createShopMediaUploadHandlers", () => {
  it("presigns then confirms an uploaded object", async () => {
    const storage = createFakeObjectStorage();
    const repository = createMemoryShopMediaAssetRepository();
    const handlers = createShopMediaUploadHandlers({ storage, repository, imageProbe: probe });

    const presign = await handlers.presign({
      kind: "artwork_image",
      contentType: "image/png",
      byteSize: PNG_HEADER.byteLength,
      subjectId: "staff-subject",
    });
    expect(presign.key).toMatch(/^shop\/artwork\//);
    await storage.putObject(presign.key, PNG_HEADER, "image/png");

    const confirmed = await handlers.confirm({ key: presign.key, alt: "Test alt" });
    expect(confirmed.publicUrl).toBe(`https://cdn.test/${presign.key}`);
    expect(confirmed.width).toBe(800);
    expect(confirmed.alt).toBe("Test alt");
    expect(await repository.findByKey(presign.key)).toMatchObject({ status: "active" });
  });

  it("rejects and deletes an object whose bytes are not the declared image type", async () => {
    const storage = createFakeObjectStorage();
    const repository = createMemoryShopMediaAssetRepository();
    const handlers = createShopMediaUploadHandlers({ storage, repository, imageProbe: probe });
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    const presign = await handlers.presign({
      kind: "artwork_image",
      contentType: "image/png",
      byteSize: html.byteLength,
      subjectId: "staff-subject",
    });
    await storage.putObject(presign.key, html, "image/png");

    await expect(handlers.confirm({ key: presign.key, alt: null })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(await repository.findByKey(presign.key)).toMatchObject({ status: "rejected" });
    expect(storage.objects.has(presign.key)).toBe(false);
  });

  it("rejects an object stored with a different content type than presigned", async () => {
    const storage = createFakeObjectStorage();
    const repository = createMemoryShopMediaAssetRepository();
    const handlers = createShopMediaUploadHandlers({ storage, repository, imageProbe: probe });
    const presign = await handlers.presign({
      kind: "artwork_image",
      contentType: "image/png",
      byteSize: PNG_HEADER.byteLength,
      subjectId: "staff-subject",
    });
    await storage.putObject(presign.key, PNG_HEADER, "text/html");

    await expect(handlers.confirm({ key: presign.key, alt: null })).rejects.toMatchObject({
      statusCode: 400,
      message: "Uploaded object content type does not match the presigned type",
    });
    expect(storage.objects.has(presign.key)).toBe(false);
  });
});
