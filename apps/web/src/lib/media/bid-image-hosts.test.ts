import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { LAX_MEDIA_HOSTS, isImageHostname } from "./bid-image-hosts";

const patterns = nextConfig.images?.remotePatterns ?? [];
const hostnames = patterns.map((pattern) => ("hostname" in pattern ? pattern.hostname : ""));

describe("Bid's image hosts", () => {
  it("name LAX's own Spaces, production and test, on both addresses each answers on", () => {
    expect([...LAX_MEDIA_HOSTS]).toEqual([
      "lax-media.lon1.cdn.digitaloceanspaces.com",
      "lax-media.lon1.digitaloceanspaces.com",
      "lax-test-media.lon1.cdn.digitaloceanspaces.com",
      "lax-test-media.lon1.digitaloceanspaces.com",
    ]);
  });

  it("do not allow every Space: the build config has no wildcard host anywhere", () => {
    expect(hostnames.filter((host) => host.includes("*"))).toEqual([]);
    expect(hostnames).not.toContain("*.digitaloceanspaces.com");
  });

  it("keep every host the app already used", () => {
    for (const host of [
      "lax-media.lon1.cdn.digitaloceanspaces.com",
      "lh3.googleusercontent.com",
      "images.unsplash.com",
      "media.lax.bid",
      "test-media.lax.bid",
      "images.metmuseum.org",
      "openaccess-cdn.clevelandart.org",
      "test.lax.bid",
    ]) {
      expect(hostnames).toContain(host);
    }
    for (const host of LAX_MEDIA_HOSTS) expect(hostnames).toContain(host);
  });

  it("serve pictures over https only", () => {
    expect(patterns.every((pattern) => pattern.protocol === "https")).toBe(true);
  });

  it("lists each host once", () => {
    expect(new Set(hostnames).size).toBe(hostnames.length);
  });
});

describe("isImageHostname", () => {
  it("accepts every host the config names", () => {
    for (const host of hostnames) expect(isImageHostname(host)).toBe(true);
  });

  it.each([
    "*.digitaloceanspaces.com",
    "https://cdn.example.com",
    "cdn.example.com/path",
    "cdn.example.com:8443",
    "localhost",
    "-bad.example.com",
    "a b.example.com",
  ])("refuses %s", (value) => {
    expect(isImageHostname(value)).toBe(false);
  });
});
