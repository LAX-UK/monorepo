import { isAllowedStreamUrl, parseStreamEmbedUrl } from "@auction/validators";
import { describe, expect, it } from "vitest";

describe("parseStreamEmbedUrl", () => {
  it("parses youtube watch URL", () => {
    const r = parseStreamEmbedUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw");
    expect(r?.provider).toBe("youtube");
    expect(r?.src).toBe("https://www.youtube.com/embed/jNQXAC9IVRw?rel=0");
    expect(r?.videoId).toBe("jNQXAC9IVRw");
    expect(r?.startSeconds).toBeUndefined();
  });

  it("parses youtube watch URL with t=11s and embeds start", () => {
    const r = parseStreamEmbedUrl("https://www.youtube.com/watch?v=AtO699gsFS8&t=11s");
    expect(r?.provider).toBe("youtube");
    expect(r?.videoId).toBe("AtO699gsFS8");
    expect(r?.startSeconds).toBe(11);
    expect(r?.src).toBe("https://www.youtube.com/embed/AtO699gsFS8?rel=0&start=11");
  });

  it("parses youtube start=90 query", () => {
    const r = parseStreamEmbedUrl("https://www.youtube.com/watch?v=AtO699gsFS8&start=90");
    expect(r?.startSeconds).toBe(90);
    expect(r?.src).toContain("&start=90");
  });

  it("parses youtu.be short URL", () => {
    const r = parseStreamEmbedUrl("https://youtu.be/jNQXAC9IVRw");
    expect(r?.provider).toBe("youtube");
    expect(r?.src).toContain("/embed/jNQXAC9IVRw");
    expect(r?.videoId).toBe("jNQXAC9IVRw");
  });

  it("parses vimeo", () => {
    const r = parseStreamEmbedUrl("https://vimeo.com/123456789");
    expect(r?.provider).toBe("vimeo");
    expect(r?.src).toBe("https://player.vimeo.com/video/123456789");
  });

  it("parses vimeo player embed URL", () => {
    const r = parseStreamEmbedUrl("https://player.vimeo.com/video/99");
    expect(r?.provider).toBe("vimeo");
    expect(r?.src).toBe("https://player.vimeo.com/video/99");
  });

  it("parses twitch channel", () => {
    const r = parseStreamEmbedUrl("https://www.twitch.tv/monstercat");
    expect(r?.provider).toBe("twitch");
    expect(r?.src).toContain("channel=monstercat");
  });

  it("canonicalizes cloudflare mediadelivery iframe (drops query string)", () => {
    const r = parseStreamEmbedUrl(
      "https://iframe.mediadelivery.net/abc123def/video?token=evil&x=1",
    );
    expect(r?.provider).toBe("cloudflare");
    expect(r?.src).toBe("https://iframe.mediadelivery.net/abc123def/video");
    expect(r?.src).not.toContain("?");
  });

  it("canonicalizes customer cloudflarestream iframe path (drops query string)", () => {
    const r = parseStreamEmbedUrl(
      "https://customer-abc123.cloudflarestream.com/00000000-0000-4000-8000-000000000001/iframe?foo=bar",
    );
    expect(r?.provider).toBe("cloudflare");
    expect(r?.src).not.toContain("?");
    expect(r?.src).toContain("/iframe");
  });

  it("rejects unsupported hosts", () => {
    expect(parseStreamEmbedUrl("https://evil.com/embed/x")).toBeNull();
    expect(isAllowedStreamUrl("https://evil.com/embed/x")).toBe(false);
  });

  it("allows known hosts for storage validation", () => {
    expect(isAllowedStreamUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw")).toBe(true);
    expect(isAllowedStreamUrl("https://player.vimeo.com/video/1")).toBe(true);
  });
});
