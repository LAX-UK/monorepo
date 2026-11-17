/**
 * What `next build` wrote for lax.art's prerendered pages, read from `.next/prerender-manifest.json`.
 * Shared by the build step that drops their build-time HTML and the CI check that they are still
 * prerendered.
 */

/**
 * Routes that must be prerendered (static or ISR). The same list as ART_PRERENDERED_ROUTES in
 * src/lib/routing/prerendered-routes.ts; prerendered-output.test.ts keeps the two equal.
 */
export const REQUIRED_PRERENDERED_ROUTES = ["/prerendered/home"];

/** The longest a prerendered page may go unregenerated when no tag revalidates it (pack C, Q1). */
export const MAX_REVALIDATE_SECONDS = 300;

/** Why the build output breaks the rule, one line each; empty when it holds. */
export function findPrerenderProblems(manifest, required = REQUIRED_PRERENDERED_ROUTES) {
  const routes = manifest?.routes ?? {};
  const problems = [];
  for (const route of required) {
    const entry = routes[route];
    if (!entry) {
      problems.push(
        `${route} is not prerendered: something in its render reads the request (cookies, headers, the session or search params) or opts out of the cache, so Next made it dynamic. Move that part into the browser instead.`,
      );
      continue;
    }
    const seconds = entry.initialRevalidateSeconds;
    if (typeof seconds !== "number" || seconds <= 0 || seconds > MAX_REVALIDATE_SECONDS) {
      problems.push(
        `${route} regenerates after ${String(seconds)} seconds; it must be between 1 and ${MAX_REVALIDATE_SECONDS}.`,
      );
    }
  }
  return problems;
}

/** The file name (without extension) Next stores a prerendered route under in `server/app`. */
export function prerenderedFileBase(route) {
  return route === "/" ? "index" : route.replace(/^\//, "");
}

/** Every prerendered route in the manifest. */
export function prerenderedRoutes(manifest) {
  return Object.keys(manifest?.routes ?? {});
}
