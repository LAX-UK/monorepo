import { HERO_COVER_DEFAULTS } from "@/lib/media/hero-cover-defaults";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";

export type HeroCoverSources = {
  desktopUrl: string | null;
  mobileUrl?: string | null;
  desktopWideUrl?: string | null;
  objectPosition?: string;
};

export type HeroCoverSourcesInput = {
  desktopUrl: string | null | undefined;
  mobileUrl?: string | null | undefined;
  desktopWideUrl?: string | null | undefined;
  objectPosition?: string | undefined;
};

/** Normalizes raw VM / API cover fields into resolved URLs for hero rendering. */
export function resolveHeroCoverSources(input: HeroCoverSourcesInput): HeroCoverSources {
  const desktopUrl = resolveMediaSrc(input.desktopUrl) ?? null;
  const mobileResolved = input.mobileUrl?.trim()
    ? (resolveMediaSrc(input.mobileUrl) ?? null)
    : null;
  const mobileUrl = mobileResolved && mobileResolved !== desktopUrl ? mobileResolved : null;
  const wideResolved = input.desktopWideUrl?.trim()
    ? (resolveMediaSrc(input.desktopWideUrl) ?? null)
    : null;
  const desktopWideUrl = wideResolved && wideResolved !== desktopUrl ? wideResolved : null;
  const objectPosition = input.objectPosition?.trim() || undefined;

  return {
    desktopUrl,
    mobileUrl,
    desktopWideUrl,
    ...(objectPosition ? { objectPosition } : {}),
  };
}

export function heroCoverObjectPosition(sources: HeroCoverSources): {
  mobile: string;
  desktop: string;
} {
  if (sources.objectPosition) {
    return { mobile: sources.objectPosition, desktop: sources.objectPosition };
  }
  return {
    mobile: HERO_COVER_DEFAULTS.objectPositionMobile,
    desktop: HERO_COVER_DEFAULTS.objectPositionDesktop,
  };
}
