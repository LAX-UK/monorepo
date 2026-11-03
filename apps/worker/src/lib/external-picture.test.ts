import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { fetchExternalPicture, isPrivateAddress, meanLuminance } from "./external-picture.js";

const png = (colour: string) =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: colour } })
    .png()
    .toBuffer();

describe("isPrivateAddress", () => {
  it("flags loopback, private and link-local addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "::ffff:10.0.0.1",
    ]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
    for (const address of ["8.8.8.8", "151.101.1.1", "2606:4700::1"]) {
      expect(isPrivateAddress(address)).toBe(false);
    }
  });
});

describe("fetchExternalPicture", () => {
  const publicHost = async () => ["151.101.1.1"];

  it("reads a picture from a public https address", async () => {
    const bytes = await png("#ff0000");
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(bytes)));
    const out = await fetchExternalPicture("https://images.example.com/a.png", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolveHost: publicHost,
    });
    expect(out.byteLength).toBe(bytes.byteLength);
  });

  it("refuses http, and hosts that resolve to private addresses, without fetching", async () => {
    const fetchImpl = vi.fn();
    const deps = { fetchImpl: fetchImpl as unknown as typeof fetch, resolveHost: publicHost };
    await expect(fetchExternalPicture("http://images.example.com/a.png", deps)).rejects.toThrow(
      "external_picture_not_https",
    );
    await expect(
      fetchExternalPicture("https://internal.example.com/a.png", {
        ...deps,
        resolveHost: async () => ["10.0.0.5"],
      }),
    ).rejects.toThrow("external_picture_host_not_public");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a failed response", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 404 }));
    await expect(
      fetchExternalPicture("https://images.example.com/a.png", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        resolveHost: publicHost,
      }),
    ).rejects.toThrow("external_picture_status_404");
  });
});

describe("meanLuminance", () => {
  it("is 0 for black, 1 for white and between for grey", async () => {
    expect(await meanLuminance(await png("#000000"))).toBe(0);
    expect(await meanLuminance(await png("#ffffff"))).toBe(1);
    const grey = await meanLuminance(await png("#808080"));
    expect(grey).toBeGreaterThan(0.45);
    expect(grey).toBeLessThan(0.55);
  });
});
