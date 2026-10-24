import type { EditorialBlock } from "@auction/shop-contracts";
import type { ImportArtworkHandler } from "../handlers/import-artwork.handler.js";
import type {
  ImportArtworkCommand,
  ImportArtworkObjectType,
  ImportArtworkRarity,
} from "../ports/artwork-import.writer.js";
import type {
  ImportedEditorialOutcome,
  LegacyThelaxContentStore,
} from "../ports/legacy-thelax-import.ports.js";
import type { LegacyMediaImporter, LegacyMediaStats } from "./legacy-media-importer.js";
import {
  type LegacyBlockRewriter,
  type LegacyBlockStats,
  emptyBlockStats,
  firstParagraph,
  rewriteLegacyBlocks,
} from "./legacy-thelax-blocks.js";
import type { LegacyArtwork, LegacyTaxonomy, LegacyThelaxExport } from "./legacy-thelax-export.js";
import {
  type LegacyRedirectMap,
  buildLegacyRedirects,
  legacyArtistSlugs,
  plannedArtworkSlugs,
} from "./legacy-thelax-redirects.js";
import { LEGACY_PAGE_RULES, legacyPageRule, taxonomyPageSlug } from "./legacy-thelax-url-map.js";

export const LEGACY_THELAX_IMPORT_ACTOR = "legacy-thelax-import";

export function legacyImportKey(legacyPath: string): string {
  return `thelax:${legacyPath}`;
}

export type LegacyThelaxImportDeps = {
  importArtwork: ImportArtworkHandler;
  store: LegacyThelaxContentStore;
  media: LegacyMediaImporter;
};

type OutcomeCounts = Record<ImportedEditorialOutcome, number>;

export type LegacyThelaxImportReport = {
  artists: Record<"created" | "updated" | "unchanged", number>;
  artworks: { created: number; updated: number; slugConflicts: string[] };
  taxonomyPages: OutcomeCounts;
  stories: OutcomeCounts;
  pages: OutcomeCounts;
  media: LegacyMediaStats;
  blocks: LegacyBlockStats;
  errors: Array<{ legacyPath: string; message: string }>;
};

const STANDFIRST_MAX_LENGTH = 280;
const RAIL_MAX_ARTWORKS = 24;
const DEFAULT_CONCURRENCY = 4;

function emptyOutcomes(): OutcomeCounts {
  return { created: 0, updated: 0, kept_staff_edit: 0 };
}

async function forEachConcurrent<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next] as T;
      next += 1;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

const PRINT_TECHNIQUE = /print|gicl[eé]e|litho|etching|engraving|screen|offset/i;
const SCULPTURE_TECHNIQUE = /bronze|marble|ceramic|sculpt|resin/i;
const PAPER_TECHNIQUE = /paper|water ?colou?r|vellum|drawing|pastel|charcoal/i;

export function legacyObjectType(artwork: LegacyArtwork): ImportArtworkObjectType {
  if (artwork.kind === "print") return "print";
  if (artwork.kind === "sculpture") return "sculpture";
  const technique = artwork.techniques.map((t) => t.name).join(" ");
  if (/photo/i.test(technique)) return "photography";
  if (PRINT_TECHNIQUE.test(technique)) return "print";
  if (SCULPTURE_TECHNIQUE.test(technique)) return "sculpture";
  if (PAPER_TECHNIQUE.test(technique)) return "work_on_paper";
  if (/mixed media/i.test(technique)) return "mixed_media";
  return "painting";
}

export function legacyRarity(artwork: LegacyArtwork): ImportArtworkRarity | null {
  if (artwork.unique) return "unique";
  return legacyObjectType(artwork) === "print" ? "limited_edition" : null;
}

function taxonomyTitle(taxonomy: LegacyTaxonomy): string {
  return taxonomy.taxonomy === "technique" ? `${taxonomy.name} artworks` : `${taxonomy.name} art`;
}

function taxonomyIntro(taxonomy: LegacyTaxonomy): string {
  if (taxonomy.intro?.trim()) return taxonomy.intro.trim();
  const subject =
    taxonomy.taxonomy === "technique"
      ? `made with ${taxonomy.name.toLowerCase()}`
      : taxonomy.taxonomy === "style"
        ? `in the ${taxonomy.name} style`
        : `from the ${taxonomy.name} period`;
  return `Browse original artworks and editions ${subject} from the LAX Art collection, with details on each artist, medium and availability.`;
}

/** Same-URL routes and the home page resolve to themselves inside rewritten content. */
function samePaths(): Set<string> {
  const paths = new Set(["/"]);
  for (const [slug, rule] of Object.entries(LEGACY_PAGE_RULES)) {
    if (rule.kind === "same") paths.add(`/${slug}`);
  }
  return paths;
}

export async function importLegacyThelax(
  deps: LegacyThelaxImportDeps,
  data: LegacyThelaxExport,
  options: { concurrency?: number; log?: (message: string) => void } = {},
): Promise<{ redirects: LegacyRedirectMap; report: LegacyThelaxImportReport }> {
  const log = options.log ?? (() => undefined);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const report: LegacyThelaxImportReport = {
    artists: { created: 0, updated: 0, unchanged: 0 },
    artworks: { created: 0, updated: 0, slugConflicts: [] },
    taxonomyPages: emptyOutcomes(),
    stories: emptyOutcomes(),
    pages: emptyOutcomes(),
    media: deps.media.stats(),
    blocks: emptyBlockStats(),
    errors: [],
  };
  const recordError = (legacyPath: string, error: unknown) => {
    report.errors.push({
      legacyPath,
      message: error instanceof Error ? error.message : String(error),
    });
  };

  const artistSlugs = legacyArtistSlugs(data);
  const artistsByPath = new Map(data.artists.map((artist) => [artist.legacyPath, artist]));

  log(`artists: ${artistSlugs.size}`);
  await forEachConcurrent([...artistSlugs], concurrency, async ([legacyPath, slug]) => {
    const artist = artistsByPath.get(legacyPath);
    const displayName =
      artist?.name ?? data.artworks.find((a) => a.artistLegacyPath === legacyPath)?.artistName;
    if (!displayName) {
      recordError(legacyPath, "artist has no name");
      return;
    }
    try {
      const portraitImageUrl = artist?.portraitUrl
        ? await deps.media.importImage(
            artist.portraitUrl,
            "artist_portrait",
            `Portrait of ${displayName}`,
          )
        : null;
      const outcome = await deps.store.ensureArtist({
        slug,
        displayName,
        bio: artist?.bio ?? null,
        portraitImageUrl,
        seoTitle: artist?.seoTitle ?? null,
        seoDescription: artist?.seoDescription ?? null,
      });
      report.artists[outcome] += 1;
    } catch (error) {
      recordError(legacyPath, error);
    }
  });

  const planned = plannedArtworkSlugs(data.artworks);
  const importedSlugs = new Map<string, string>();
  log(`artworks: ${data.artworks.length}`);
  await forEachConcurrent(data.artworks, concurrency, async (artwork) => {
    const slug = planned.get(artwork.legacyPath) ?? artwork.slug;
    const artistSlug = artwork.artistLegacyPath ? artistSlugs.get(artwork.artistLegacyPath) : null;
    if (!artistSlug) {
      recordError(artwork.legacyPath, "artwork has no artist");
      return;
    }
    try {
      const importKey = legacyImportKey(artwork.legacyPath);
      const owner = await deps.store.findArtworkImportKey(slug);
      if (owner !== undefined && owner !== importKey) {
        report.artworks.slugConflicts.push(artwork.legacyPath);
        return;
      }
      const artist = await deps.store.findArtist(artistSlug);
      const artistName = artist?.displayName ?? artwork.artistName ?? artistSlug;
      const images: Array<{ mediaKey: string; alt: string | null }> = [];
      for (const image of artwork.images) {
        const alt = image.alt ?? `${artwork.title} by ${artistName}`;
        const mediaKey = await deps.media.importImage(image.url, "artwork_image", alt);
        if (mediaKey) images.push({ mediaKey, alt });
      }
      const command: ImportArtworkCommand = {
        importKey,
        // Migrates artworks already public on the legacy site, so they stay public.
        publishOnCreate: true,
        slug,
        title: artwork.title,
        description: artwork.description,
        primaryImageUrl: images[0]?.mediaKey ?? null,
        dimensions: artwork.dimensionsText,
        medium: artwork.techniques[0]?.name ?? null,
        yearCreated: artwork.year,
        saleState: artwork.sold ? "sold" : "price_on_application",
        artistSlug,
        artistDisplayName: artistName,
        artistDiscipline: artist?.discipline ?? null,
        artistPortraitUrl: artist?.portraitImageUrl ?? null,
        eligibleForEditionAllocation: false,
        seoTitle: artwork.seoTitle,
        seoDescription: artwork.seoDescription,
        salesChannel: "art",
        objectType: legacyObjectType(artwork),
        rarity: legacyRarity(artwork),
        heightCm: artwork.dimensions?.heightCm ?? null,
        widthCm: artwork.dimensions?.widthCm ?? null,
        depthCm: artwork.dimensions?.depthCm ?? null,
        hasCertificate: artwork.certificate,
        images,
      };
      const result = await deps.importArtwork(command);
      report.artworks[result.created ? "created" : "updated"] += 1;
      importedSlugs.set(artwork.legacyPath, slug);
    } catch (error) {
      recordError(artwork.legacyPath, error);
    }
  });

  const contentRedirects = buildLegacyRedirects(data, { artworkSlugs: importedSlugs });
  const same = samePaths();
  const inline: LegacyBlockRewriter = {
    resolveLegacyPath: (path) => contentRedirects[path] ?? (same.has(path) ? path : null),
    importImage: (url, alt) => deps.media.importImage(url, "editorial_inline", alt),
  };

  log(`taxonomy pages: ${data.taxonomies.length}`);
  for (const taxonomy of data.taxonomies) {
    const slugs = data.artworks
      .filter((artwork) =>
        [...artwork.styles, ...artwork.techniques, ...artwork.periods].some(
          (ref) => ref.legacyPath === taxonomy.legacyPath,
        ),
      )
      .sort((a, b) => Number(a.sold) - Number(b.sold))
      .map((artwork) => importedSlugs.get(artwork.legacyPath))
      .filter((slug): slug is string => Boolean(slug))
      .slice(0, RAIL_MAX_ARTWORKS);
    const body: EditorialBlock[] = [
      { type: "richText", spans: [{ text: taxonomyIntro(taxonomy) }] },
      ...(slugs.length > 0
        ? [
            {
              type: "artworkRail" as const,
              headline: "Works in the collection",
              artworkSlugs: slugs,
            },
          ]
        : []),
    ];
    try {
      const outcome = await deps.store.upsertPage({
        slug: taxonomyPageSlug(taxonomy.taxonomy, taxonomy.slug),
        title: taxonomyTitle(taxonomy),
        body,
        seoTitle: taxonomy.seoTitle,
        seoDescription: taxonomy.seoDescription,
        actor: LEGACY_THELAX_IMPORT_ACTOR,
      });
      report.taxonomyPages[outcome] += 1;
    } catch (error) {
      recordError(taxonomy.legacyPath, error);
    }
  }

  log(`stories: ${data.stories.length}`);
  await forEachConcurrent(data.stories, concurrency, async (story) => {
    try {
      const body = await rewriteLegacyBlocks(story.body, inline, report.blocks);
      const coverMediaKey = story.cover
        ? await deps.media.importImage(story.cover.url, "editorial_cover", story.cover.alt)
        : null;
      const outcome = await deps.store.upsertStory({
        slug: story.slug,
        title: story.title,
        standfirst: firstParagraph(body, STANDFIRST_MAX_LENGTH),
        coverMediaKey,
        body,
        seoTitle: story.seoTitle,
        seoDescription: story.seoDescription,
        actor: LEGACY_THELAX_IMPORT_ACTOR,
      });
      report.stories[outcome] += 1;
    } catch (error) {
      recordError(story.legacyPath, error);
    }
  });

  log(`pages: ${data.pages.length}`);
  for (const page of data.pages) {
    const rule = legacyPageRule(page.slug);
    if (rule?.kind !== "page" && rule?.kind !== "legal") continue;
    try {
      const body = await rewriteLegacyBlocks(page.body, inline, report.blocks);
      const outcome = await deps.store.upsertPage({
        slug: rule.slug,
        title: page.title,
        body,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        actor: LEGACY_THELAX_IMPORT_ACTOR,
      });
      report.pages[outcome] += 1;
    } catch (error) {
      recordError(page.legacyPath, error);
    }
  }

  const redirects = buildLegacyRedirects(data, {
    artworkSlugs: importedSlugs,
    imageUrls: deps.media.publicUrls(),
  });
  return { redirects, report };
}
