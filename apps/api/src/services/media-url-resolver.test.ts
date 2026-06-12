import { describe, expect, it, vi } from "vitest";
import type { IObjectStorage } from "./interfaces/object-storage.js";
import { MediaUrlResolver } from "./media-url-resolver.js";
import { PerRequestSigningPolicy, StableSigningPolicy } from "./signed-url-policy.js";

function storage(): IObjectStorage {
  return {
    putObject: vi.fn(),
    getPublicUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`),
    createPresignedPut: vi.fn(),
    createPresignedGet: vi.fn(async ({ key }) => ({
      url: `https://signed.example.com/${key}?signature=1`,
    })),
    extractKey: vi.fn((value: string) => {
      if (value.startsWith("https://cdn.example.com/")) {
        return value.slice("https://cdn.example.com/".length);
      }
      if (!value.startsWith("http")) return value;
      return null;
    }),
    headObject: vi.fn(),
    getObjectBytes: vi.fn(),
    deleteObject: vi.fn(),
  };
}

describe("MediaUrlResolver", () => {
  it("returns public storage URLs for owned keys in public mode", async () => {
    const s = storage();
    const resolver = new MediaUrlResolver(s, "public", new PerRequestSigningPolicy(900));

    await expect(resolver.resolve("uploads/pending/avatar/u/1.webp")).resolves.toBe(
      "https://cdn.example.com/uploads/pending/avatar/u/1.webp",
    );
    expect(s.createPresignedGet).not.toHaveBeenCalled();
  });

  it("returns presigned GET URLs for owned keys in signed mode", async () => {
    const s = storage();
    const resolver = new MediaUrlResolver(s, "signed", new PerRequestSigningPolicy(300));

    await expect(resolver.resolve("uploads/pending/avatar/u/1.webp")).resolves.toBe(
      "https://signed.example.com/uploads/pending/avatar/u/1.webp?signature=1",
    );
    expect(s.createPresignedGet).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "uploads/pending/avatar/u/1.webp",
        expiresInSec: 300,
      }),
    );
  });

  it("uses stable signing date for catalogue policy", async () => {
    const s = storage();
    const fixed = new Date("2026-06-13T15:30:00.000Z");
    vi.setSystemTime(fixed);
    const resolver = new MediaUrlResolver(s, "signed", new StableSigningPolicy(86_400));

    await resolver.resolve("uploads/pending/avatar/u/1.webp");

    expect(s.createPresignedGet).toHaveBeenCalledWith({
      key: "uploads/pending/avatar/u/1.webp",
      expiresInSec: 86_400,
      signingDate: new Date(Date.UTC(2026, 5, 13)),
    });
    vi.useRealTimers();
  });

  it("passes through foreign image URLs", async () => {
    const s = storage();
    const resolver = new MediaUrlResolver(s, "signed", new PerRequestSigningPolicy(900));

    await expect(resolver.resolve("https://lh3.googleusercontent.com/avatar")).resolves.toBe(
      "https://lh3.googleusercontent.com/avatar",
    );
  });
});
