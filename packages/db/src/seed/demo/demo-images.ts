/**
 * The pictures the demo seeds show, and where their fast copies live.
 *
 * Source pictures are museum originals (several MB, 3,000 px and more). A worker step downloads
 * each one, resizes it for how the demo uses it, and uploads it to the test media bucket under
 * `seed/demo/`. The seeds write the address of that copy, so the apps serve a small picture from the
 * CDN. This module is the one list both sides read: the seeds ask it for an address, the step asks
 * it for what to mirror. It holds no I/O.
 */
import { createHash } from "node:crypto";
import { COVER_IMAGES, DEPARTMENTS, WORKS } from "./demo-full-works.js";

/** Where a picture is shown, which decides how large its copy is. */
export type DemoImageKind = "cover" | "lot" | "portrait";

/** Long edge in pixels for each kind. Covers feed the hero and slots; lots hang on a plate. */
export const DEMO_IMAGE_LONG_EDGE: Record<DemoImageKind, number> = {
  cover: 2400,
  lot: 1600,
  portrait: 1200,
};

export const DEMO_JPEG_QUALITY = 82;
/** Under `seed/`, which the bucket policy already serves publicly. */
export const DEMO_KEY_PREFIX = "seed/demo";
/** Public address of the test media bucket the apps read from. */
export const DEMO_MEDIA_BASE_URL = "https://lax-media.lon1.cdn.digitaloceanspaces.com";

/** The Met and Cleveland Open Access collections are CC0; so is the generative work made for the demo. */
function licenceOf(source: string): string {
  return new URL(source).hostname.endsWith("test.lax.bid") ? "CC0 (made for this demo)" : "CC0";
}

function providerOf(source: string): string {
  const { hostname } = new URL(source);
  if (hostname === "images.metmuseum.org") return "The Met Open Access";
  if (hostname === "openaccess-cdn.clevelandart.org") return "Cleveland Museum of Art Open Access";
  return hostname;
}

/** Stable storage key for a source picture shown as `kind`: readable name plus a short hash. */
export function demoImageKey(source: string, kind: DemoImageKind): string {
  const file = new URL(source).pathname.split("/").pop() ?? "picture";
  const name = file
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const hash = createHash("sha1").update(source).digest("hex").slice(0, 8);
  return `${DEMO_KEY_PREFIX}/${kind}/${name || "picture"}-${hash}.jpg`;
}

/** The address of a source picture's copy, as the seeds store it and the apps load it. */
export function demoImageUrl(source: string, kind: DemoImageKind): string {
  return `${DEMO_MEDIA_BASE_URL}/${demoImageKey(source, kind)}`;
}

const met = (path: string) => `https://images.metmuseum.org/CRDImages/${path}`;

/** One distinct portrait per seeded artist: single-sitter paintings from The Met (CC0). */
export const DEMO_PORTRAIT_SOURCES: readonly string[] = [
  met("ep/original/DP-16323-001.jpg"),
  met("ep/original/DP-44361-001.jpg"),
  met("ep/original/DP-14286-011.jpg"),
  met("ep/original/DT1502_cropped2.jpg"),
  met("ep/original/DP-27908-001.jpg"),
  met("ep/original/DP169215.jpg"),
  met("ep/original/DP-18371-001.jpg"),
  met("ep/original/DP320086.jpg"),
  met("ep/original/DP-14286-001.jpg"),
  met("ep/original/DP-1019-01.jpg"),
  met("ep/original/DP353256.jpg"),
  met("ep/original/DP169218.jpg"),
  met("ep/original/DP-26278-001.jpg"),
  met("ep/original/DP151185.jpg"),
  met("ep/original/DP287624.jpg"),
  met("ep/original/DP243354.jpg"),
  met("ep/original/DP-35674-001.jpg"),
];

/**
 * The portrait for the n-th artist: each of the first seventeen gets its own picture; beyond that
 * the list starts again.
 */
export function demoPortraitUrl(index: number): string {
  const source = DEMO_PORTRAIT_SOURCES[index % DEMO_PORTRAIT_SOURCES.length] as string;
  return demoImageUrl(source, "portrait");
}

/** The source picture shown for a department: the first work in it. */
export function departmentHeroSource(slug: string): string | undefined {
  return Object.values(WORKS).find((work) => work.department === slug)?.image;
}

export type DemoImageEntry = {
  source: string;
  kind: DemoImageKind;
  key: string;
  longEdge: number;
  licence: string;
  provider: string;
};

function entryOf(source: string, kind: DemoImageKind): DemoImageEntry {
  return {
    source,
    kind,
    key: demoImageKey(source, kind),
    longEdge: DEMO_IMAGE_LONG_EDGE[kind],
    licence: licenceOf(source),
    provider: providerOf(source),
  };
}

/** Every copy the seeds point at, once each, ordered by key. */
export function demoImageCatalogue(): DemoImageEntry[] {
  const entries = new Map<string, DemoImageEntry>();
  const add = (source: string | undefined, kind: DemoImageKind) => {
    if (!source) return;
    const next = entryOf(source, kind);
    entries.set(next.key, next);
  };
  for (const work of Object.values(WORKS)) add(work.image, "lot");
  for (const cover of Object.values(COVER_IMAGES)) add(cover, "cover");
  for (const department of DEPARTMENTS) add(departmentHeroSource(department.slug), "cover");
  for (const portrait of DEMO_PORTRAIT_SOURCES) add(portrait, "portrait");
  return [...entries.values()].sort((a, b) => a.key.localeCompare(b.key));
}
