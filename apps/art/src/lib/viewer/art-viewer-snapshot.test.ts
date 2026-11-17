import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseArtViewerChromeSnapshot,
  parseArtViewerFavouritesSnapshot,
  readArtViewerChrome,
  readArtViewerFavourites,
} from "./art-viewer-snapshot";

const SIGNED_IN = {
  kind: "authenticated",
  displayName: "Ada",
  email: "ada@example.test",
  accountHref: "/account",
  logoutHref: "/logout",
};

describe("parseArtViewerChromeSnapshot", () => {
  it("accepts each account kind with a reply dot flag", () => {
    expect(parseArtViewerChromeSnapshot({ account: SIGNED_IN, replyDot: true })).toEqual({
      account: SIGNED_IN,
      replyDot: true,
    });
    for (const kind of ["guest", "disabled", "unavailable"]) {
      expect(parseArtViewerChromeSnapshot({ account: { kind }, replyDot: false })).not.toBeNull();
    }
  });

  it("rejects anything else", () => {
    expect(parseArtViewerChromeSnapshot(null)).toBeNull();
    expect(parseArtViewerChromeSnapshot("<html>")).toBeNull();
    expect(parseArtViewerChromeSnapshot({ account: SIGNED_IN })).toBeNull();
    expect(
      parseArtViewerChromeSnapshot({ account: { kind: "staff" }, replyDot: false }),
    ).toBeNull();
  });
});

describe("parseArtViewerFavouritesSnapshot", () => {
  it("accepts two lists of slugs and rejects anything else", () => {
    const ok = { savedArtworkSlugs: ["a"], followedArtistSlugs: [] };
    expect(parseArtViewerFavouritesSnapshot(ok)).toEqual(ok);
    expect(parseArtViewerFavouritesSnapshot({ savedArtworkSlugs: ["a"] })).toBeNull();
    expect(
      parseArtViewerFavouritesSnapshot({ savedArtworkSlugs: [1], followedArtistSlugs: [] }),
    ).toBeNull();
  });
});

describe("readArtViewerChrome and readArtViewerFavourites", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("read the visitor's own endpoints without any cache", async () => {
    const fetchMock = vi.fn(async () => Response.json({ account: SIGNED_IN, replyDot: false }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(readArtViewerChrome()).resolves.toEqual({ account: SIGNED_IN, replyDot: false });
    expect(fetchMock).toHaveBeenCalledWith("/api/viewer", {
      credentials: "same-origin",
      cache: "no-store",
    });
  });

  it("never reject: a failed, refused or malformed read gives null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );
    await expect(readArtViewerChrome()).resolves.toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 503 })),
    );
    await expect(readArtViewerFavourites()).resolves.toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>", { status: 200 })),
    );
    await expect(readArtViewerFavourites()).resolves.toBeNull();
  });
});
