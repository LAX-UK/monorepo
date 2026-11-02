import { describe, expect, it } from "vitest";
import { coverFilmFor } from "./cover-film";

const sale = (over: Record<string, unknown> = {}) => ({
  title: "Modern & Contemporary",
  heroPresentation: "video" as const,
  heroVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s",
  ...over,
});

describe("coverFilmFor", () => {
  it("starts a YouTube film muted with captions on", () => {
    const film = coverFilmFor(sale());
    const url = new URL(film?.src ?? "");
    expect(url.pathname).toBe("/embed/dQw4w9WgXcQ");
    expect(url.searchParams.get("mute")).toBe("1");
    expect(url.searchParams.get("cc_load_policy")).toBe("1");
    expect(url.searchParams.get("start")).toBe("12");
    expect(film?.title).toBe("Modern & Contemporary: film");
  });

  it("starts a Vimeo film muted with captions on", () => {
    const url = new URL(
      coverFilmFor(sale({ heroVideoUrl: "https://player.vimeo.com/video/123456" }))?.src ?? "",
    );
    expect(url.searchParams.get("muted")).toBe("1");
    expect(url.searchParams.get("texttrack")).toBe("en");
  });

  it("gives no film for a cover sale, a missing address or a provider that cannot start muted", () => {
    expect(coverFilmFor(sale({ heroPresentation: "cover" }))).toBeNull();
    expect(coverFilmFor(sale({ heroVideoUrl: null }))).toBeNull();
    expect(coverFilmFor(sale({ heroVideoUrl: "https://example.com/film" }))).toBeNull();
    expect(coverFilmFor(sale({ heroVideoUrl: "https://twitch.tv/lax" }))).toBeNull();
  });
});
