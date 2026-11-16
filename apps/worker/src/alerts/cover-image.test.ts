import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import {
  EMAIL_COVER_WIDTH,
  createEmailCoverUrls,
  emailCoverKey,
  renderEmailCover,
  storageKeyOf,
} from "./cover-image.js";

const media = "https://media.lax.bid";

function memoryStorage(objects: Record<string, Buffer> = {}) {
  const store = new Map(Object.entries(objects));
  return {
    store,
    headObject: vi.fn(async (key: string) => (store.has(key) ? { byteSize: 1 } : null)),
    getObjectBytes: vi.fn(async (key: string) => store.get(key) ?? null),
    putObject: vi.fn(async (key: string, body: Buffer) => {
      store.set(key, body);
      return { url: `${media}/${key}` };
    }),
  };
}

describe("email cover addresses", () => {
  it("names the copy beside its original, as a JPEG", () => {
    expect(emailCoverKey("uploads/pending/sales/u1/abc.webp")).toBe(
      "uploads/pending/sales/u1/abc.email-640.jpg",
    );
  });

  it("reads a stored key, or an address on our own media host, and nothing else", () => {
    expect(storageKeyOf("uploads/a.jpg", media)).toBe("uploads/a.jpg");
    expect(storageKeyOf("/uploads/a.jpg", media)).toBe("uploads/a.jpg");
    expect(storageKeyOf(`${media}/uploads/a.jpg`, media)).toBe("uploads/a.jpg");
    expect(storageKeyOf("https://elsewhere.example/a.jpg", media)).toBeNull();
    expect(storageKeyOf("  ", media)).toBeNull();
  });

  it("makes the copy once and gives the media host's absolute address, never the site's optimiser", async () => {
    const storage = memoryStorage({ "uploads/s/spring.png": Buffer.from("original") });
    const render = vi.fn(async () => Buffer.from("jpeg"));
    const urlFor = createEmailCoverUrls({ storage, mediaBaseUrl: `${media}/`, render });

    const url = await urlFor("uploads/s/spring.png");
    expect(url).toBe(`${media}/uploads/s/spring.email-640.jpg`);
    expect(url).not.toContain("/_next/image");
    expect(storage.putObject).toHaveBeenCalledWith(
      "uploads/s/spring.email-640.jpg",
      Buffer.from("jpeg"),
      "image/jpeg",
    );

    await urlFor(`${media}/uploads/s/spring.png`);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("gives no picture when it cannot place or make one, and never throws", async () => {
    const warn = vi.fn();
    const storage = memoryStorage({ "uploads/broken.jpg": Buffer.from("x") });
    const urlFor = createEmailCoverUrls({
      storage,
      mediaBaseUrl: media,
      render: async () => {
        throw new Error("unsupported image");
      },
      log: { warn },
    });
    expect(await urlFor("uploads/missing.jpg")).toBeNull();
    expect(await urlFor("uploads/broken.jpg")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await urlFor("https://elsewhere.example/a.jpg")).toBeNull();
    expect(
      await createEmailCoverUrls({ storage, mediaBaseUrl: null })("uploads/broken.jpg"),
    ).toBeNull();
  });

  it("renders a 640 pixel wide baseline JPEG on white from a transparent PNG", async () => {
    const png = await sharp({
      create: { width: 1600, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const out = await renderEmailCover(png);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(EMAIL_COVER_WIDTH);
    expect(meta.isProgressive).toBe(false);
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
  });
});
