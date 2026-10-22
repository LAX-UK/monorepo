import type { ArtEditorialStorySummary } from "@/lib/editorial/art-editorial.types";
import { fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeStoriesIndexPage } from "./stories-index-page.composer.js";

function summary(
  slug: string,
  overrides: Partial<ArtEditorialStorySummary> = {},
): ArtEditorialStorySummary {
  return {
    slug,
    kind: "article",
    title: slug,
    standfirst: null,
    coverUrl: null,
    featured: false,
    publishedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("composeStoriesIndexPage", () => {
  it("lists every story newest first on All, kicked with category and date", async () => {
    const services = fakeArtServices();
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          summary("old", { publishedAt: "2026-01-01T00:00:00.000Z" }),
          summary("new", { kind: "press", publishedAt: "2026-09-12T00:00:00.000Z" }),
        ],
      },
    });
    const result = await composeStoriesIndexPage(services, "all");
    expect(services.editorial.listStories).toHaveBeenCalledWith({});
    expect(result).toMatchObject({
      status: "ok",
      data: {
        cards: [
          { key: "new", kicker: "Press", kickerDetail: "12 Sept 2026", meta: null },
          { key: "old", kicker: "Article", kickerDetail: "1 Jan 2026" },
        ],
        latestEpisode: null,
      },
    });
  });

  it("narrows the artists tab to stories and films", async () => {
    const services = fakeArtServices();
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: {
        items: [summary("a"), summary("p", { kind: "podcast" }), summary("r", { kind: "press" })],
      },
    });
    const result = await composeStoriesIndexPage(services, "artists");
    expect(result).toMatchObject({ data: { cards: [{ key: "a" }] } });
  });

  it("asks the API for press by kind", async () => {
    const services = fakeArtServices();
    services.editorial.listStories.mockResolvedValue({ status: "ok", data: { items: [] } });
    await composeStoriesIndexPage(services, "press");
    expect(services.editorial.listStories).toHaveBeenCalledWith({ kind: "press" });
  });

  it("leads the podcast tab with its newest playable episode and leaves it out of the grid", async () => {
    const services = fakeArtServices();
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          summary("ep1", { kind: "podcast", publishedAt: "2026-08-01T00:00:00.000Z" }),
          summary("ep2", { kind: "podcast", publishedAt: "2026-09-01T00:00:00.000Z" }),
        ],
      },
    });
    services.editorial.getStory.mockResolvedValue({
      status: "ok",
      data: {
        ...summary("ep2", { kind: "podcast" }),
        videoUrl: null,
        body: [],
        audioUrl: "https://media.example/a.mp3",
      },
    });
    const result = await composeStoriesIndexPage(services, "podcast");
    expect(services.editorial.listStories).toHaveBeenCalledWith({ kind: "podcast" });
    expect(services.editorial.getStory).toHaveBeenCalledWith("ep2");
    expect(result).toMatchObject({
      data: { latestEpisode: { href: "/stories/ep2" }, cards: [{ key: "ep1" }] },
    });
  });

  it("keeps the newest episode in the grid when it has no audio", async () => {
    const services = fakeArtServices();
    services.editorial.listStories.mockResolvedValue({
      status: "ok",
      data: { items: [summary("ep", { kind: "podcast" })] },
    });
    services.editorial.getStory.mockResolvedValue({
      status: "ok",
      data: { ...summary("ep", { kind: "podcast" }), videoUrl: null, body: [], audioUrl: null },
    });
    const result = await composeStoriesIndexPage(services, "podcast");
    expect(result).toMatchObject({ data: { latestEpisode: null, cards: [{ key: "ep" }] } });
  });

  it("passes failures through", async () => {
    const services = fakeArtServices();
    services.editorial.listStories.mockResolvedValue({ status: "error" });
    expect(await composeStoriesIndexPage(services, "all")).toEqual({ status: "error" });
  });
});
