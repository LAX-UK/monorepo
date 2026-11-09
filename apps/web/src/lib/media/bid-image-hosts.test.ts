import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import {
  LAX_MEDIA_HOSTS,
  bidMediaImageHosts,
  extraImageHosts,
  isImageHostname,
  publicMediaHost,
} from "./bid-image-hosts";

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

describe("extraImageHosts", () => {
  it("adds hosts from the deployment's list", () => {
    expect(extraImageHosts(" Cdn.Example.com , images.example.org ")).toEqual([
      "cdn.example.com",
      "images.example.org",
    ]);
    expect(extraImageHosts(undefined)).toEqual([]);
    expect(extraImageHosts("")).toEqual([]);
  });

  it.each([
    "*.digitaloceanspaces.com",
    "https://cdn.example.com",
    "cdn.example.com/path",
    "cdn.example.com:8443",
    "localhost",
    "-bad.example.com",
    "a b.example.com",
    "xn--.com",
  ])("stops the build for %s rather than widening the list", (value) => {
    expect(() => extraImageHosts(value)).toThrow("not a plain host name");
  });
});

describe("publicMediaHost", () => {
  it("reads the host of an https media address", () => {
    expect(publicMediaHost("https://media.lax.bid/")).toBe("media.lax.bid");
    expect(publicMediaHost("https://lax-media.lon1.cdn.digitaloceanspaces.com/uploads")).toBe(
      "lax-media.lon1.cdn.digitaloceanspaces.com",
    );
  });

  it("ignores anything that is not an https address with a plain host", () => {
    for (const value of [undefined, "", "not a url", "http://media.lax.bid", "https://localhost"]) {
      expect(publicMediaHost(value)).toBeNull();
    }
  });
});

describe("bidMediaImageHosts", () => {
  it("is LAX's Spaces alone by default", () => {
    expect(bidMediaImageHosts({})).toEqual([...LAX_MEDIA_HOSTS]);
  });

  it("adds the configured public media host and the deployment's additions, once each", () => {
    expect(
      bidMediaImageHosts({
        S3_PUBLIC_BASE_URL: "https://media.lax.bid",
        BID_IMAGE_REMOTE_HOSTS: "media.lax.bid,cdn.example.com",
      }),
    ).toEqual([...LAX_MEDIA_HOSTS, "media.lax.bid", "cdn.example.com"]);
  });

  it("is a plain host name check", () => {
    expect(isImageHostname("media.lax.bid")).toBe(true);
    expect(isImageHostname("*.lax.bid")).toBe(false);
  });
});
