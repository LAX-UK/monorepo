import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/og", () => ({
  ImageResponse: class {
    async arrayBuffer() {
      return new Uint8Array([137, 80, 78, 71]).buffer;
    }
  },
}));

// The web image's standalone output has no working sharp: importing it throws.
vi.mock("sharp", () => {
  throw new Error('Could not load the "sharp" module using the linuxmusl-x64 runtime');
});

const { loadSharp, renderOgJpeg, resetSharpForTests } = await import("./og-image-response");

afterEach(() => resetSharpForTests());

describe("OG cards without sharp", () => {
  it("serves the PNG card when sharp cannot load, instead of failing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await renderOgJpeg(null as never);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).not.toContain("immutable");
  });

  it("compresses to JPEG when sharp loads", async () => {
    const toBuffer = vi.fn(async () => Buffer.from([255, 216]));
    const sharp = vi.fn(() => ({ jpeg: () => ({ toBuffer }) }));
    await loadSharp(async () => ({ default: sharp as never }));
    const response = await renderOgJpeg(null as never);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(sharp).toHaveBeenCalled();
  });

  it.each([
    ["lot", () => import("@/app/(marketing)/lot/[slug]/[id]/opengraph-image")],
    ["sale", () => import("@/app/(marketing)/sales/[slug]/[id]/opengraph-image")],
    ["artist", () => import("@/app/(marketing)/artist/[slug]/[id]/opengraph-image")],
  ])(
    "loads the %s card module, which its page reads for metadata, without loading sharp",
    async (_route, load) => {
      await expect(load()).resolves.toHaveProperty("generateImageMetadata");
    },
    // The first import transforms the page's whole module graph.
    30_000,
  );
});

describe("sharp stays out of module scope", () => {
  it("is only ever imported lazily, so no page depends on a native binary to render", () => {
    const src = join(__dirname, "../..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          if (/^import[^;]*from\s+["']sharp["']/m.test(readFileSync(path, "utf8"))) {
            offenders.push(relative(src, path));
          }
        }
      }
    };
    walk(src);
    expect(offenders).toEqual([]);
  });
});
