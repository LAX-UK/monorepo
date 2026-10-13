/**
 * Pure rules for verifying the LAX Art legacy-redirect layer against the crawl inventory and
 * gold list. The redirect map is the expectation; the deployed middleware is what is checked.
 */
import { extractSeo, parseLegacyHtml } from "./legacy-thelax-extract.mjs";

/** Destinations that absorb many unrelated legacy URLs; Google may treat these as soft 404s. */
export const GENERIC_DESTINATIONS = new Set([
  "/artworks",
  "/paintings",
  "/prints",
  "/sculptures",
  "/artists",
  "/exhibitions",
  "/collector-hub",
  "/art-hub",
]);

export function isExternalTarget(target) {
  return /^https?:\/\//.test(target);
}

/**
 * Expected final URL for a legacy path (query ignored, the old CMS params are dropped).
 * Unmapped paths must be served in place by a real route (e.g. `/`, `/paintings`).
 */
export function expectedLegacyTarget(legacyPath, redirects) {
  const pathname = new URL(legacyPath, "https://legacy.invalid").pathname;
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const target = redirects[path] ?? redirects[path.toLowerCase()];
  return target ? { path: target, redirect: true } : { path, redirect: false };
}

/** Inventory (status 200 on the old site) plus gold-list paths, deduplicated, inventory first. */
export function buildVerificationTargets({ inventory, gold, redirects }) {
  const byPath = new Map();
  const add = (path, source, family) => {
    const existing = byPath.get(path);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }
    byPath.set(path, {
      path,
      family: family ?? "unknown",
      sources: [source],
      expected: expectedLegacyTarget(path, redirects),
    });
  };
  for (const entry of inventory?.entries ?? []) {
    if (entry.status === 200) add(entry.path, "inventory", entry.family);
  }
  for (const entry of gold?.entries ?? []) add(entry.path, "gold");
  return [...byPath.values()];
}

const fail = (issue) => ({ outcome: "fail", issues: [issue] });

/**
 * Outcome of the first response to a legacy URL. An unmapped URL that 404s was retired on
 * purpose by the importer (no equivalent page); that is only a failure for gold-list URLs,
 * which carry traffic or backlinks and must land somewhere.
 */
export function checkRedirectHop(response, target, canonicalOrigin) {
  const { expected } = target;
  if (!expected.redirect) {
    if (response.status === 200) return { outcome: "pass", issues: [] };
    if (response.status === 404 || response.status === 410) {
      const issue = `retired: unmapped and ${response.status}`;
      return target.sources.includes("gold")
        ? fail(`gold URL ${issue}`)
        : { outcome: "retired", issues: [issue] };
    }
    return fail(`unmapped: not served in place (${response.status})`);
  }
  if (response.status !== 301) {
    return fail(
      `expected 301, got ${response.status}${response.location ? ` -> ${response.location}` : ""}`,
    );
  }
  if (!response.location) return fail("301 without Location");
  const location = new URL(response.location, canonicalOrigin);
  const want = new URL(expected.path, canonicalOrigin);
  if (
    location.origin === want.origin &&
    location.pathname === want.pathname &&
    location.search === ""
  ) {
    return { outcome: "pass", issues: [] };
  }
  return fail(`redirects to ${location.toString()}, expected ${want.toString()}`);
}

function hasNoindex(value) {
  return /\bnoindex\b/i.test(value ?? "");
}

/**
 * Issues for the final destination: exactly one hop (200, no further redirect), a
 * self-referencing canonical, indexable, and a non-empty title and meta description.
 */
export function checkDestination(response, destinationUrl, { allowNoindex = false } = {}) {
  if (response.status >= 300 && response.status < 400) {
    return [`redirect chain: destination ${response.status} -> ${response.location ?? "?"}`];
  }
  if (response.status !== 200) return [`destination returned ${response.status}`];
  const seo = extractSeo(parseLegacyHtml(response.body ?? ""));
  const issues = [];
  const expectedCanonical = new URL(destinationUrl).toString();
  if (!seo.canonical) issues.push("missing canonical");
  else if (new URL(seo.canonical, destinationUrl).toString() !== expectedCanonical) {
    issues.push(`canonical ${seo.canonical} is not self-referencing (${expectedCanonical})`);
  }
  if (!allowNoindex && (hasNoindex(seo.robots) || hasNoindex(response.robotsHeader))) {
    issues.push("destination is noindex");
  }
  if (!seo.title) issues.push("missing title");
  if (!seo.description) issues.push("missing meta description");
  return issues;
}

/** Non-blocking parity gaps worth an owner decision before cutover. */
export function parityGaps(targets) {
  const fanIn = new Map();
  for (const target of targets) {
    if (!target.expected?.redirect) continue;
    const list = fanIn.get(target.expected.path) ?? [];
    list.push(target.path);
    fanIn.set(target.expected.path, list);
  }
  const gaps = [];
  for (const target of targets) {
    if (!target.expected?.redirect) continue;
    if (GENERIC_DESTINATIONS.has(target.expected.path)) {
      gaps.push({
        path: target.path,
        kind: "generic-destination",
        detail: `${target.family} page lands on listing ${target.expected.path}`,
      });
    }
  }
  for (const [destination, sources] of fanIn) {
    if (sources.length > 1 && !GENERIC_DESTINATIONS.has(destination)) {
      gaps.push({
        path: destination,
        kind: "many-to-one",
        detail: `${sources.length} legacy URLs share this destination`,
      });
    }
  }
  return gaps;
}
