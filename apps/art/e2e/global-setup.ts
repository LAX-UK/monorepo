import type { FullConfig } from "@playwright/test";

/**
 * Heavy, cold-on-first-hit routes. `/artworks` has no `loading.tsx`, so the first request blocks on
 * five parallel shop-api reads (cold Postgres and Next data cache) before the document is sent,
 * then its priority `<img>` tags go through the cold `/_next/image` optimiser, which delays the
 * `load` event that `page.goto` waits for. With `fullyParallel` and two projects the first specs to
 * land on these routes paid that cost inside their own 30 s budget, and intermittently lost.
 */
const WARM_PATHS = ["/artworks", "/artworks?view=list", "/artists", "/search"] as const;
const WARM_TIMEOUT_MS = 90_000;

async function warm(baseURL: string, path: string): Promise<void> {
  const response = await fetch(new URL(path, baseURL), {
    signal: AbortSignal.timeout(WARM_TIMEOUT_MS),
  });
  const html = await response.text();
  // Prime the image optimiser for the first card images the page preloads.
  const images = [...html.matchAll(/<img[^>]+src="(\/_next\/image\?[^"]+)"/g)]
    .slice(0, 4)
    .map((match) => (match[1] ?? "").replaceAll("&amp;", "&"));
  await Promise.allSettled(
    images.map((src) =>
      fetch(new URL(src, baseURL), { signal: AbortSignal.timeout(WARM_TIMEOUT_MS) }).then((r) =>
        r.arrayBuffer(),
      ),
    ),
  );
}

/** Best effort: a failed warm-up must never fail the run, the specs still assert for themselves. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  if (process.env.PLAYWRIGHT_E2E !== "1") return;
  const baseURL = config.projects[0]?.use.baseURL ?? process.env.PLAYWRIGHT_BASE_URL;
  if (!baseURL) return;
  await Promise.allSettled(WARM_PATHS.map((path) => warm(baseURL, path)));
}
