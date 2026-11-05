import type { ZohoImageSource } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import { ImageUndecodableError } from "./image-normalizer.js";
import { sha256Hex, storedImageKey } from "./validate-image.js";
import { ZohoImageSyncService } from "./zoho-image-sync.service.js";
import {
  type RemoteProductImage,
  ZohoImageFetchError,
  type ZohoProductImageGateway,
} from "./zoho-product-image.js";

const NOW = new Date("2026-11-05T02:30:00.000Z");
const JPEG_A = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("picture-a")]);
const JPEG_B = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("picture-b")]);

const remote = (fileId: string, fingerprint = "f1"): RemoteProductImage => ({
  fileId,
  fingerprint,
  origin: fileId === "record_image" ? "record_image" : "attachment",
  fileName: null,
});
const sourceFor = (fileId: string, bytes: Buffer, fingerprint = "f1"): ZohoImageSource => {
  const sha256 = sha256Hex(bytes);
  return { zohoFileId: fileId, fingerprint, sha256, key: storedImageKey(sha256, "image/jpeg") };
};

function setup(options: {
  listed: RemoteProductImage[] | Error;
  files?: Record<string, Buffer | ZohoImageFetchError | Error>;
  current?: ZohoImageSource[] | null;
  stored?: string[];
}) {
  const files = options.files ?? {};
  const gateway: ZohoProductImageGateway = {
    listImages: vi.fn(async () => {
      if (options.listed instanceof Error) throw options.listed;
      return options.listed;
    }),
    downloadImage: vi.fn(async (_id, image) => {
      const file = files[image.fileId];
      if (file instanceof Error) throw file;
      if (!file) throw new ZohoImageFetchError("not_found", false);
      return file;
    }),
  };
  const objects = new Set(options.stored ?? []);
  const store = {
    findImageSources: vi.fn(async () => (options.current === undefined ? [] : options.current)),
    replaceZohoImages: vi.fn(async () => ({ status: "replaced" as const, entry: {} as never })),
    listImageCheckCandidates: vi.fn(),
  };
  const objectStore = {
    exists: vi.fn(async (key: string) => objects.has(key)),
    put: vi.fn(async (key: string) => {
      objects.add(key);
    }),
  };
  const normalizer = {
    normalize: vi.fn(async (bytes: Buffer) => ({ bytes, width: 10, height: 10 })),
  };
  const log = { warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  const service = new ZohoImageSyncService({
    gateway,
    store,
    objects: objectStore,
    normalizer,
    log: log as never,
    now: () => NOW,
  });
  return { service, gateway, store, objectStore, normalizer, log };
}

describe("ZohoImageSyncService live", () => {
  it("copies the record image first and the attachments after it, in Zoho's order", async () => {
    const t = setup({
      listed: [remote("record_image"), remote("att1")],
      files: { record_image: JPEG_A, att1: JPEG_B },
    });
    const report = await t.service.syncProduct("p1", "live");

    expect(report).toMatchObject({
      status: "checked",
      remote: 2,
      downloaded: 2,
      reused: 0,
      changed: true,
    });
    expect(t.store.replaceZohoImages).toHaveBeenCalledWith({
      zohoProductId: "p1",
      sources: [sourceFor("record_image", JPEG_A), sourceFor("att1", JPEG_B)],
      now: NOW,
    });
    expect(t.objectStore.put).toHaveBeenCalledTimes(2);
  });

  it("does not download a picture that is already copied and unchanged", async () => {
    const t = setup({
      listed: [remote("att1")],
      current: [sourceFor("att1", JPEG_A)],
      stored: [sourceFor("att1", JPEG_A).key],
    });
    const report = await t.service.syncProduct("p1", "live");
    expect(t.gateway.downloadImage).not.toHaveBeenCalled();
    expect(report).toMatchObject({ reused: 1, downloaded: 0 });
  });

  it("stores the same content once when two Zoho files hold it", async () => {
    const t = setup({
      listed: [remote("record_image"), remote("att1")],
      files: { record_image: JPEG_A, att1: JPEG_A },
    });
    await t.service.syncProduct("p1", "live");
    expect(t.objectStore.put).toHaveBeenCalledTimes(1);
    expect(t.normalizer.normalize).toHaveBeenCalledTimes(1);
  });

  it("does not store again an object that is already there", async () => {
    const key = sourceFor("att1", JPEG_A).key;
    const t = setup({ listed: [remote("att1")], files: { att1: JPEG_A }, stored: [key] });
    await t.service.syncProduct("p1", "live");
    expect(t.objectStore.put).not.toHaveBeenCalled();
    expect(t.store.replaceZohoImages).toHaveBeenCalled();
  });

  it("fetches a changed file again and drops one Zoho removed", async () => {
    const t = setup({
      listed: [remote("att1", "f2")],
      files: { att1: JPEG_B },
      current: [sourceFor("att1", JPEG_A, "f1"), sourceFor("gone", JPEG_A)],
    });
    const report = await t.service.syncProduct("p1", "live");
    expect(report).toMatchObject({ downloaded: 1, removed: 1, changed: true });
    expect(t.store.replaceZohoImages).toHaveBeenCalledWith(
      expect.objectContaining({ sources: [sourceFor("att1", JPEG_B, "f2")] }),
    );
  });

  it("clears the register's pictures when Zoho has none left", async () => {
    const t = setup({ listed: [], current: [sourceFor("att1", JPEG_A)] });
    const report = await t.service.syncProduct("p1", "live");
    expect(report).toMatchObject({ remote: 0, removed: 1, changed: true });
    expect(t.store.replaceZohoImages).toHaveBeenCalledWith(
      expect.objectContaining({ sources: [] }),
    );
  });

  it("skips a file that is not a picture and still copies the others", async () => {
    const t = setup({
      listed: [remote("att1"), remote("att2")],
      files: { att1: Buffer.from("%PDF-1.7 ..."), att2: JPEG_B },
    });
    const report = await t.service.syncProduct("p1", "live");
    expect(report).toMatchObject({ rejected: 1, downloaded: 1, failed: 0 });
    expect(t.store.replaceZohoImages).toHaveBeenCalledWith(
      expect.objectContaining({ sources: [sourceFor("att2", JPEG_B)] }),
    );
  });

  it("skips a picture that cannot be decoded or that Zoho says is too large", async () => {
    const t = setup({
      listed: [remote("att1"), remote("att2")],
      files: { att1: JPEG_A, att2: new ZohoImageFetchError("too_large", false) },
    });
    t.normalizer.normalize.mockRejectedValueOnce(new ImageUndecodableError());
    const report = await t.service.syncProduct("p1", "live");
    expect(report).toMatchObject({ rejected: 2, downloaded: 0, changed: true });
    expect(t.objectStore.put).not.toHaveBeenCalled();
  });

  it("leaves the register's pictures alone when one cannot be fetched right now", async () => {
    const t = setup({
      listed: [remote("att1"), remote("att2")],
      files: { att1: JPEG_A, att2: new ZohoImageFetchError("unavailable", true) },
      current: [sourceFor("old", JPEG_B)],
    });
    const report = await t.service.syncProduct("p1", "live");
    expect(report).toMatchObject({ failed: 1, changed: false });
    expect(t.store.replaceZohoImages).not.toHaveBeenCalled();
  });

  it("leaves the pictures alone when the object store fails", async () => {
    const t = setup({ listed: [remote("att1")], files: { att1: JPEG_A } });
    t.objectStore.put.mockRejectedValueOnce(new Error("spaces down"));
    const report = await t.service.syncProduct("p1", "live");
    expect(report).toMatchObject({ failed: 1, changed: false });
    expect(t.store.replaceZohoImages).not.toHaveBeenCalled();
  });

  it("keeps the register's pictures when Zoho cannot be listed", async () => {
    const t = setup({ listed: new Error("zoho 503") });
    const report = await t.service.syncProduct("p1", "live");
    expect(report.status).toBe("unavailable");
    expect(t.store.replaceZohoImages).not.toHaveBeenCalled();
  });

  it("does nothing for a Product the register has no record of", async () => {
    const t = setup({ listed: [remote("att1")], current: null });
    expect(await t.service.syncProduct("p1", "live")).toMatchObject({ status: "no_record" });
    expect(t.gateway.listImages).not.toHaveBeenCalled();
  });

  it("reports unchanged when nothing differs", async () => {
    const t = setup({
      listed: [remote("att1")],
      current: [sourceFor("att1", JPEG_A)],
    });
    t.store.replaceZohoImages.mockResolvedValueOnce({ status: "unchanged" } as never);
    expect(await t.service.syncProduct("p1", "live")).toMatchObject({ changed: false });
  });
});

describe("ZohoImageSyncService dry run", () => {
  it("counts what live would copy and touches nothing", async () => {
    const t = setup({
      listed: [remote("record_image"), remote("att1")],
      current: [sourceFor("att1", JPEG_A)],
    });
    const report = await t.service.syncProduct("p1", "dry_run");
    expect(report).toMatchObject({ status: "checked", remote: 2, reused: 1, downloaded: 1 });
    expect(t.gateway.downloadImage).not.toHaveBeenCalled();
    expect(t.objectStore.put).not.toHaveBeenCalled();
    expect(t.store.replaceZohoImages).not.toHaveBeenCalled();
  });

  it("counts pictures for a Product the register would only now create", async () => {
    const t = setup({ listed: [remote("att1")], current: null });
    expect(await t.service.syncProduct("p1", "dry_run")).toMatchObject({
      status: "checked",
      remote: 1,
      downloaded: 1,
    });
  });
});
