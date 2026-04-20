import { describe, expect, it } from "vitest";
import { isAllowedStreamUrl, parseStreamEmbedUrl } from "@auction/validators";

describe("parseStreamEmbedUrl", () => {
  it("parses youtube watch URL", () => {
    const r = parseStreamEmbedUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw");
    expect(r?.provider).toBe("youtube");
    expect(r?.src).toBe("https://www.youtube.com/embed/jNQXAC9IVRw?rel=0");
  });

  it("parses youtu.be short URL", () => {
    const r = parseStreamEmbedUrl("https://youtu.be/jNQXAC9IVRw");
    expect(r?.provider).toBe("youtube");
    expect(r?.src).toContain("/embed/jNQXAC9IVRw");
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

  it("rejects unsupported hosts", () => {
    expect(parseStreamEmbedUrl("https://evil.com/embed/x")).toBeNull();
    expect(isAllowedStreamUrl("https://evil.com/embed/x")).toBe(false);
  });

  it("allows known hosts for storage validation", () => {
    expect(isAllowedStreamUrl("https://www.youtube.com/watch?v=jNQXAC9IVRw")).toBe(true);
    expect(isAllowedStreamUrl("https://player.vimeo.com/video/1")).toBe(true);
  });
});
