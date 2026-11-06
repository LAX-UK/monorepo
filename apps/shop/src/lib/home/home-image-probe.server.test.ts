import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { createImageProbe, readFromPublicFolder } from "./home-image-probe.server";

vi.mock("server-only", () => ({}));

async function publicFolder() {
  const dir = await mkdtemp(path.join(tmpdir(), "shop-public-"));
  await mkdir(path.join(dir, "shop", "home"), { recursive: true });
  const png = await sharp({
    create: { width: 40, height: 50, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .png()
    .toBuffer();
  await writeFile(path.join(dir, "shop", "home", "work.png"), png);
  return dir;
}

describe("shop image probe", () => {
  it("measures a picture the Shop serves from its public folder, without the network", async () => {
    const dir = await publicFolder();
    const probe = createImageProbe([readFromPublicFolder(dir)], vi.fn());
    const facts = await probe("/shop/home/work.png");
    expect(facts).toMatchObject({ width: 40, height: 50 });
    expect(facts?.mean[0]).toBeGreaterThan(facts?.mean[2] ?? 255);
  });

  it("does not read outside the public folder", async () => {
    const dir = await publicFolder();
    const read = readFromPublicFolder(dir);
    expect(await read("/../etc/passwd")).toBeNull();
    expect(await read("//evil.example/x.png")).toBeNull();
  });

  it("logs a failure once per picture", async () => {
    const warn = vi.fn();
    const probe = createImageProbe(
      [
        async () => {
          throw new Error("HTTP 403 from https://x/y.webp");
        },
      ],
      warn,
    );
    expect(await probe("/y.webp")).toBeNull();
    expect(await probe("/y.webp")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toMatchObject({ reason: "HTTP 403 from https://x/y.webp" });
  });

  it("uses the next source when the first has nothing", async () => {
    const dir = await publicFolder();
    const probe = createImageProbe([async () => null, readFromPublicFolder(dir)], vi.fn());
    expect(await probe("/shop/home/work.png")).not.toBeNull();
  });
});
