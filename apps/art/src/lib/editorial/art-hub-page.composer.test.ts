import type {
  ArtEditorialStoryDetail,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import { composeArtHubPage } from "./art-hub-page.composer.js";

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

function detail(
  slug: string,
  overrides: Partial<ArtEditorialStoryDetail> = {},
): ArtEditorialStoryDetail {
  return { ...summary(slug), videoUrl: null, body: [], ...overrides };
}

function withEditorial() {
  const services = fakeArtServices();
  services.editorial.home.mockResolvedValue({ status: "ok", data: { placements: [] } as never });
  services.editorial.listExhibitions.mockResolvedValue({ status: "ok", data: { items: [] } });
  services.editorial.listStories.mockResolvedValue({ status: "ok", data: { items: [] } });
  return services;
}

describe("composeArtHubPage", () => {
  it("passes a disabled editorial module through", async () => {
    expect(await composeArtHubPage(fakeArtServices())).toEqual({ status: "disabled" });
  });

  it("shows only the copy-led panels when no data exists", async () => {
    const result = await composeArtHubPage(withEditorial());
    expect(result).toMatchObject({
      status: "ok",
      data: { sections: ["hero", "collecting"], podcast: null, film: null, press: [] },
    });
  });

  it("shows every section in Figma order when each has data", async () => {
    const services = withEditorial();
    services.editorial.listExhibitions.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            slug: "new-originals",
            kind: "exhibition",
            title: "New Originals",
            summary: null,
            startsOn: "2026-10-01",
            endsOn: "2026-12-01",
            coverUrl: "/cover.webp",
            featured: false,
          },
        ],
      },
    });
    services.editorial.listStories.mockImplementation(async (filter) => {
      if (filter?.kind === "podcast") {
        return { status: "ok", data: { items: [summary("ep", { kind: "podcast" })] } };
      }
      if (filter?.kind === "film") {
        return { status: "ok", data: { items: [summary("film", { kind: "film" })] } };
      }
      if (filter?.kind === "press") {
        return { status: "ok", data: { items: [summary("review", { kind: "press" })] } };
      }
      return { status: "ok", data: { items: [summary("interview", { readMinutes: 5 })] } };
    });
    services.editorial.getStory.mockImplementation(async (slug) => ({
      status: "ok",
      data:
        slug === "ep"
          ? detail("ep", { kind: "podcast", audioUrl: "https://media.example/a.mp3" })
          : detail("film", { kind: "film", videoUrl: "https://vimeo.example/1" }),
    }));
    services.catalogue.listArtists.mockResolvedValue({
      items: [{ slug: "flora", name: "Flora Powers", imageUrl: null }],
    });
    services.ecosystem.crossProductLinks.mockReturnValue([
      { id: "bid", label: "LAX.bid", href: "https://lax.bid" },
      { id: "shop", label: "LAX Shop", href: "https://shop.example" },
    ]);

    const result = await composeArtHubPage(services);
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.data.sections).toEqual([
      "hero",
      "now-on",
      "stories",
      "spotlight",
      "podcast",
      "films",
      "collecting",
      "press",
      "product-doors",
    ]);
    expect(result.data.heroImageUrl).toBe("/cover.webp");
    expect(result.data.stories[0]).toMatchObject({ kicker: "Article", kickerDetail: "5 MIN READ" });
  });

  it("hides the podcast panel when the episode has no audio file", async () => {
    const services = withEditorial();
    services.editorial.listStories.mockImplementation(async (filter) => ({
      status: "ok",
      data: { items: filter?.kind === "podcast" ? [summary("ep", { kind: "podcast" })] : [] },
    }));
    services.editorial.getStory.mockResolvedValue({
      status: "ok",
      data: detail("ep", { kind: "podcast", audioUrl: null }),
    });
    const result = await composeArtHubPage(services);
    expect(result).toMatchObject({ status: "ok", data: { podcast: null } });
  });

  it("prefers the story a curator placed over the newest episode", async () => {
    const services = withEditorial();
    services.editorial.home.mockResolvedValue({
      status: "ok",
      data: {
        placements: [
          {
            slot: "art_hub_podcast",
            position: 0,
            headline: null,
            mediaUrl: null,
            linkUrl: null,
            refKind: "story",
            refSlug: "placed",
          },
        ],
      } as never,
    });
    services.editorial.listStories.mockImplementation(async (filter) => ({
      status: "ok",
      data: { items: filter?.kind === "podcast" ? [summary("newest", { kind: "podcast" })] : [] },
    }));
    services.editorial.getStory.mockResolvedValue({
      status: "ok",
      data: detail("placed", { kind: "podcast", audioUrl: "https://media.example/a.mp3" }),
    });
    await composeArtHubPage(services);
    expect(services.editorial.getStory).toHaveBeenCalledWith("placed");
    expect(services.editorial.getStory).not.toHaveBeenCalledWith("newest");
  });
});
