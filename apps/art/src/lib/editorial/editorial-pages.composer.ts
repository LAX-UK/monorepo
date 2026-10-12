import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialFetchResult,
  ArtEditorialPreview,
  ArtEditorialStoryDetail,
  ArtEditorialVenueDetail,
  ArtExhibitionStatus,
} from "@/lib/editorial/art-editorial.types";
import {
  type EditorialBodyVm,
  composeEditorialBody,
} from "@/lib/editorial/editorial-body.composer";
import {
  type EditorialCardVm,
  buildPlacementCards,
  exhibitionCard,
  formatExhibitionDates,
  storyCard,
} from "@/lib/editorial/editorial-card.vm";
import type {
  ArtCataloguePort,
  ArtEditorialPort,
  ArtFavoritesReadPort,
  ArtViewerPort,
} from "@/lib/ports";

type BodyServices = {
  catalogue: Pick<ArtCataloguePort, "getArtwork" | "getArtist">;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
};

type Services<K extends keyof ArtEditorialPort> = BodyServices & {
  editorial: Pick<ArtEditorialPort, K>;
};

/** Non-ok fetch results pass through unchanged so pages share one status renderer. */
export type ArtEditorialPageResult<T> =
  | Exclude<ArtEditorialFetchResult<never>, { status: "ok" }>
  | { status: "ok"; data: T };

function passThrough<T>(
  result: Exclude<ArtEditorialFetchResult<unknown>, { status: "ok" }>,
): ArtEditorialPageResult<T> {
  return result;
}

export type OpeningHoursRow = { label: string; value: string };

/** Accepts `{ "Tue – Sat": "10:00 – 18:00" }`, `[{ label, hours }]` or a plain string. */
export function presentOpeningHours(value: unknown): OpeningHoursRow[] {
  if (typeof value === "string") {
    return value.trim() ? [{ label: "Opening hours", value: value.trim() }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const { label, hours, value: rowValue } = row as Record<string, unknown>;
      const text = typeof hours === "string" ? hours : rowValue;
      return typeof label === "string" && typeof text === "string" && label.trim() && text.trim()
        ? [{ label: label.trim(), value: text.trim() }]
        : [];
    });
  }
  if (value && typeof value === "object") {
    // jsonb does not keep object key order, so map-form hours are re-ordered by weekday.
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([label, text]) =>
        typeof text === "string" && label.trim() && text.trim()
          ? [{ label: label.trim(), value: text.trim() }]
          : [],
      )
      .sort((a, b) => weekdayRank(a.label) - weekdayRank(b.label));
  }
  return [];
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function weekdayRank(label: string): number {
  const match = /\b(mon|tue|wed|thu|fri|sat|sun)/i.exec(label);
  return match?.[1] ? WEEKDAYS.indexOf(match[1].toLowerCase() as (typeof WEEKDAYS)[number]) : 7;
}

export const EXHIBITION_STATUS_TABS: readonly { value: ArtExhibitionStatus; label: string }[] = [
  { value: "current", label: "Now on" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

export function parseExhibitionStatus(value: string | string[] | undefined): ArtExhibitionStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "upcoming" || raw === "past" ? raw : "current";
}

export async function composeExhibitionsPage(
  services: Pick<Services<"listExhibitions">, "editorial">,
  status: ArtExhibitionStatus,
): Promise<ArtEditorialPageResult<{ status: ArtExhibitionStatus; cards: EditorialCardVm[] }>> {
  const result = await services.editorial.listExhibitions(status);
  if (result.status !== "ok") return passThrough(result);
  return { status: "ok", data: { status, cards: result.data.items.map(exhibitionCard) } };
}

export type ExhibitionDetailVm = {
  exhibition: ArtEditorialExhibitionDetail;
  kicker: string;
  dateLabel: string | null;
  venueName: string | null;
  hoursLabel: string | null;
  body: EditorialBodyVm;
};

export async function composeExhibitionDetailPage(
  services: Services<"getExhibition" | "getVenue">,
  slug: string,
): Promise<ArtEditorialPageResult<ExhibitionDetailVm>> {
  const result = await services.editorial.getExhibition(slug);
  if (result.status !== "ok") return passThrough(result);
  const exhibition = result.data;
  const returnTo = `/exhibitions/${encodeURIComponent(exhibition.slug)}`;
  const [venueResult, body] = await Promise.all([
    exhibition.venueSlug ? services.editorial.getVenue(exhibition.venueSlug) : null,
    composeEditorialBody(exhibition.body, services, returnTo),
  ]);
  const venueHours =
    venueResult?.status === "ok"
      ? presentOpeningHours(venueResult.data.openingHours)
          .map((row) => `${row.label} ${row.value}`)
          .join(" · ")
      : "";
  return {
    status: "ok",
    data: {
      exhibition,
      kicker: exhibitionCard(exhibition).kicker ?? "Exhibition",
      dateLabel: formatExhibitionDates(exhibition.startsOn, exhibition.endsOn),
      venueName: venueResult?.status === "ok" ? venueResult.data.name : null,
      hoursLabel: exhibition.timesNote?.trim() || venueHours || null,
      body,
    },
  };
}

export async function composeStoryPage(
  services: Services<"getStory">,
  slug: string,
): Promise<
  ArtEditorialPageResult<{ story: ArtEditorialStoryDetail; kicker: string; body: EditorialBodyVm }>
> {
  const result = await services.editorial.getStory(slug);
  if (result.status !== "ok") return passThrough(result);
  const story = result.data;
  const body = await composeEditorialBody(
    story.body,
    services,
    `/stories/${encodeURIComponent(story.slug)}`,
  );
  return { status: "ok", data: { story, kicker: storyCard(story).kicker ?? "Story", body } };
}

export async function composeLegalPage(services: Services<"getPage">, slug: string) {
  const result = await services.editorial.getPage(slug);
  if (result.status !== "ok") return passThrough<{ title: string; body: EditorialBodyVm }>(result);
  const body = await composeEditorialBody(
    result.data.body,
    services,
    `/legal/${encodeURIComponent(result.data.slug)}`,
  );
  return { status: "ok" as const, data: { title: result.data.title, body } };
}

export type VisitPageVm = {
  venues: { venue: ArtEditorialVenueDetail; hours: OpeningHoursRow[]; body: EditorialBodyVm }[];
};

/** Every published venue with its detail; venues whose detail read fails are skipped. */
export async function composeVisitPage(
  services: Services<"listVenues" | "getVenue">,
): Promise<ArtEditorialPageResult<VisitPageVm>> {
  const list = await services.editorial.listVenues();
  if (list.status !== "ok") return passThrough(list);
  const details = await Promise.all(
    list.data.items.slice(0, 6).map((item) => services.editorial.getVenue(item.slug)),
  );
  const venues = await Promise.all(
    details.flatMap((detail) =>
      detail.status === "ok"
        ? [
            composeEditorialBody(detail.data.body, services, "/visit").then((body) => ({
              venue: detail.data,
              hours: presentOpeningHours(detail.data.openingHours),
              body,
            })),
          ]
        : [],
    ),
  );
  if (list.data.items.length > 0 && venues.length === 0) return { status: "error" };
  return { status: "ok", data: { venues } };
}

export type HubPageVm = { spotlight: EditorialCardVm[]; stories: EditorialCardVm[] };

export async function composeArtHubPage(
  services: Pick<Services<"home" | "listStories">, "editorial">,
): Promise<ArtEditorialPageResult<HubPageVm>> {
  const [home, stories] = await Promise.all([
    services.editorial.home(),
    services.editorial.listStories(),
  ]);
  if (home.status !== "ok" && stories.status !== "ok") return passThrough(home);
  return {
    status: "ok",
    data: {
      spotlight:
        home.status === "ok"
          ? buildPlacementCards(home.data.placements, "art_hub_spotlight", "Featured story")
          : [],
      stories: stories.status === "ok" ? stories.data.items.map(storyCard) : [],
    },
  };
}

export async function composeCollectorHubPage(
  services: Pick<Services<"home">, "editorial">,
): Promise<ArtEditorialPageResult<{ cards: EditorialCardVm[] }>> {
  const home = await services.editorial.home();
  if (home.status !== "ok") return passThrough(home);
  return {
    status: "ok",
    data: {
      cards: buildPlacementCards(home.data.placements, "collector_hub_card", "Collector resource"),
    },
  };
}

export async function composePreviewPage(
  services: Services<"preview">,
  token: string,
): Promise<ArtEditorialPageResult<{ preview: ArtEditorialPreview; body: EditorialBodyVm }>> {
  const result = await services.editorial.preview(token);
  if (result.status !== "ok") return passThrough(result);
  const body = await composeEditorialBody(result.data.body, services, "/");
  return { status: "ok", data: { preview: result.data, body } };
}
