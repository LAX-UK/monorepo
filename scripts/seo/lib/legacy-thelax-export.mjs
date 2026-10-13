import {
  extractArtist,
  extractArtwork,
  extractGlossaryTerms,
  extractPage,
  extractSeo,
  extractSeries,
  extractStory,
  extractTaxonomy,
  glossaryBlocks,
  parseLegacyHtml,
} from "./legacy-thelax-extract.mjs";
import { classifyLegacyUrl } from "./legacy-thelax-urls.mjs";

/**
 * Normalised content export (schemaVersion 1) consumed by the shop-api importer through
 * its `LegacyThelaxSource` port. A future CMS-database export must produce the same shape.
 */
export const LEGACY_EXPORT_SCHEMA_VERSION = 1;

function seoFields(html) {
  const seo = extractSeo(parseLegacyHtml(html));
  return { seoTitle: seo.title, seoDescription: seo.description };
}

/** `site-map` → `Site map` for pages whose HTML has no heading. */
function titleFromSlug(slug) {
  const words = slug.replace(/-+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
  );
}

/**
 * @param {Array<{ url: string; body: string }>} pages HTTP 200 legacy pages
 * @param {{ origin: string; generatedAt: string }} meta
 */
export function buildLegacyExport(pages, meta) {
  const artists = [];
  const artworks = [];
  const series = [];
  const taxonomies = [];
  const stories = [];
  const pages_ = [];
  const glossary = new Map();
  let glossarySeo = null;

  for (const { url, body } of pages) {
    const cls = classifyLegacyUrl(url);
    const legacyPath = new URL(url).pathname;
    switch (cls.family) {
      case "artwork": {
        const work = extractArtwork(body);
        if (!work.title) break;
        artworks.push({ legacyPath, kind: cls.kind, slug: cls.slug, ...work, ...seoFields(body) });
        break;
      }
      case "artist": {
        const artist = extractArtist(body);
        artists.push({
          legacyPath,
          slug: cls.slug,
          name: artist.name,
          bio: artist.bio,
          portraitUrl: artist.portrait,
          ...seoFields(body),
        });
        break;
      }
      case "series": {
        const item = extractSeries(body);
        series.push({
          legacyPath,
          slug: cls.slug,
          name: item.name,
          linkedArtists: item.artistLegacyPaths,
          seoTitle: seoFields(body).seoTitle,
        });
        break;
      }
      case "taxonomy": {
        const item = extractTaxonomy(body);
        taxonomies.push({
          legacyPath,
          taxonomy: cls.taxonomy,
          slug: cls.slug,
          name: item.name,
          intro: item.intro,
          ...seoFields(body),
        });
        break;
      }
      case "story": {
        const story = extractStory(body);
        if (!story.title) break;
        stories.push({ legacyPath, slug: cls.slug, ...story, ...seoFields(body) });
        break;
      }
      case "glossary": {
        if (cls.letter) glossary.set(cls.letter, extractGlossaryTerms(body));
        else glossarySeo = seoFields(body);
        break;
      }
      case "page": {
        const page = extractPage(body);
        pages_.push({
          legacyPath,
          slug: cls.slug,
          title: page.title ?? titleFromSlug(cls.slug),
          body: page.body,
          ...seoFields(body),
        });
        break;
      }
      default:
        break;
    }
  }

  if (glossary.size > 0) {
    pages_.push({
      legacyPath: "/glossary",
      slug: "glossary",
      title: "Art glossary",
      body: glossaryBlocks(glossary),
      seoTitle: glossarySeo?.seoTitle ?? null,
      seoDescription: glossarySeo?.seoDescription ?? null,
    });
  }

  const artistByName = new Map(
    artists
      .filter((artist) => artist.name)
      .map((artist) => [artist.name.toLowerCase(), artist.legacyPath]),
  );
  for (const work of artworks) {
    if (!work.artistLegacyPath && work.artistName) {
      work.artistLegacyPath = artistByName.get(work.artistName.toLowerCase()) ?? null;
    }
  }

  const artistNamePattern = (name) =>
    new RegExp(`(^|[^a-z])${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
  const namedArtists = artists
    .filter((artist) => artist.name && artist.name.length >= 3)
    .map((artist) => ({ legacyPath: artist.legacyPath, pattern: artistNamePattern(artist.name) }));
  const resolvedSeries = series.map(({ linkedArtists, seoTitle, ...item }) => {
    const fromWorks = artworks
      .filter((work) => work.series?.legacyPath === item.legacyPath)
      .map((work) => work.artistLegacyPath);
    const named = `${item.name ?? ""} | ${seoTitle ?? ""}`.toLowerCase();
    const fromName = namedArtists.filter((artist) => artist.pattern.test(named));
    return {
      ...item,
      artistLegacyPath:
        mostCommon([...linkedArtists, ...fromWorks]) ??
        (fromName.length === 1 ? fromName[0].legacyPath : null),
    };
  });

  const byPath = (a, b) => a.legacyPath.localeCompare(b.legacyPath);
  return {
    schemaVersion: LEGACY_EXPORT_SCHEMA_VERSION,
    source: "crawl",
    origin: meta.origin,
    generatedAt: meta.generatedAt,
    artists: artists.sort(byPath),
    artworks: artworks.sort(byPath),
    series: resolvedSeries.sort(byPath),
    taxonomies: taxonomies.sort(byPath),
    stories: stories.sort(byPath),
    pages: pages_.sort(byPath),
  };
}
