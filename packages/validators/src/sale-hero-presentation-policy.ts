import type { SaleHeroPresentation } from "@auction/types";
import { isAllowedStreamUrl } from "./stream-embed.js";

export type HeroPresentationState = {
  heroPresentation: SaleHeroPresentation;
  heroVideoUrl: string | null;
};

export type HeroPresentationPatch = {
  heroPresentation?: SaleHeroPresentation | undefined;
  heroVideoUrl?: string | null | undefined;
};

export const HERO_VIDEO_URL_REQUIRED =
  "Hero video URL is required when homepage hero is set to video";

export function applyHeroPresentationPatch(
  existing: HeroPresentationState,
  patch: HeroPresentationPatch,
): HeroPresentationState {
  return {
    heroPresentation: patch.heroPresentation ?? existing.heroPresentation,
    heroVideoUrl: patch.heroVideoUrl !== undefined ? patch.heroVideoUrl : existing.heroVideoUrl,
  };
}

export function isValidHeroPresentationState(state: HeroPresentationState): boolean {
  if (state.heroPresentation === "cover") return true;
  return Boolean(state.heroVideoUrl && isAllowedStreamUrl(state.heroVideoUrl));
}
