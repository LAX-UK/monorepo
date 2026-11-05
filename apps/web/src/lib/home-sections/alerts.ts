import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import type { HomeAlerts } from "@/lib/home-sections/types";

/**
 * The alerts panel: up to three works from recent sales beside the sign-up, so it shows what
 * the emails are about. With no photographs the panel stands on its words alone.
 */
export function buildAlerts(imageUrls: readonly (string | null | undefined)[]): HomeAlerts {
  const unique = [
    ...new Set(imageUrls.filter((url): url is string => typeof url === "string" && url !== "")),
  ];
  return {
    thumbnails: unique.slice(0, HOME_SECTION_LIMITS.alertThumbnails.max).map((src) => ({ src })),
  };
}
