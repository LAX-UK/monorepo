import * as Sentry from "@sentry/nextjs";

/** One report per page, so a wall of pictures that all fall back is a single signal. */
const reportedOn = new Set<string>();

function hostOf(src: string): string {
  try {
    return new URL(src, "https://site.invalid").hostname;
  } catch {
    return "unknown";
  }
}

/**
 * A picture's resized files were refused by the image route and the original took over. The
 * person sees nothing wrong, which is the point of the fallback and also why a broken
 * `remotePatterns` entry would go unnoticed, so it is reported: one warning per page, carrying
 * the picture's host and the page's path (never a query string or the full address).
 */
export function reportImageFallback(src: string, page: string = window.location.pathname): void {
  if (reportedOn.has(page)) return;
  reportedOn.add(page);
  Sentry.captureMessage("Resized image refused, original used", {
    level: "warning",
    tags: { area: "images" },
    fingerprint: ["resized-image-fallback", hostOf(src)],
    extra: { page, host: hostOf(src) },
  });
}

/** For tests: forget which pages were reported. */
export function resetImageFallbackReports(): void {
  reportedOn.clear();
}
