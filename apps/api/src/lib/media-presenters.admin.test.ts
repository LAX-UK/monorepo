import { describe, expect, it, vi } from "vitest";
import type { MediaUrlResolver } from "../services/media-url-resolver.js";
import {
  presentLotAdminImages,
  presentLotImages,
  presentSaleAdminImages,
  presentSaleImages,
} from "./media-presenters.js";

describe("media-presenters admin", () => {
  const resolver = {
    resolveManyUnique: vi.fn(async (keys: string[]) => {
      const map = new Map<string, string>();
      for (const key of keys) map.set(key, `https://cdn.example/${key}`);
      return map;
    }),
  } as unknown as MediaUrlResolver;

  it("presentSaleImages resolves keys for public consumers", async () => {
    const sale = {
      id: "s1",
      coverImages: ["key-a", "key-b"],
    } as Parameters<typeof presentSaleImages>[1];
    const out = await presentSaleImages(resolver, sale);
    expect(out.coverImages).toEqual(["https://cdn.example/key-a", "https://cdn.example/key-b"]);
  });

  it("presentSaleAdminImages keeps keys and adds presented URLs", async () => {
    const sale = {
      id: "s1",
      coverImages: ["key-a"],
    } as Parameters<typeof presentSaleAdminImages>[1];
    const out = await presentSaleAdminImages(resolver, sale);
    expect(out.coverImages).toEqual(["key-a"]);
    expect(out.coverImagePresentedUrls).toEqual(["https://cdn.example/key-a"]);
  });

  it("presentLotAdminImages keeps keys and adds presented URLs", async () => {
    const lot = {
      id: "l1",
      images: ["img-1"],
    } as Parameters<typeof presentLotAdminImages>[1];
    const out = await presentLotAdminImages(resolver, lot);
    expect(out.images).toEqual(["img-1"]);
    expect(out.imagePresentedUrls).toEqual(["https://cdn.example/img-1"]);
  });

  it("presentLotImages still resolves for public path", async () => {
    const lot = {
      id: "l1",
      images: ["img-1"],
    } as Parameters<typeof presentLotImages>[1];
    const out = await presentLotImages(resolver, lot);
    expect(out.images).toEqual(["https://cdn.example/img-1"]);
  });
});
