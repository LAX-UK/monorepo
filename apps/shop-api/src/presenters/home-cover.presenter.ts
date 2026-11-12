import type {
  AdminHomeCover,
  AdminHomeCoverPictureCandidates,
  PublicHomeCover,
} from "@auction/shop-contracts";
import type { StoredHomeCover } from "../application/home-cover/home-cover.ports.js";
import {
  HOME_COVER_MIN_WIDTH,
  homeCoverScrims,
  homeCoverSide,
} from "../application/home-cover/home-cover.rules.js";
import type {
  ClearHomeCoverCommand,
  HomeCoverService,
  SaveHomeCoverCommand,
} from "../application/home-cover/home-cover.service.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/**
 * The cover the storefront draws. A stored picture whose measuring no longer reaches contrast
 * (the rules were tightened since it was saved) is not offered, so the home leads as it did before.
 */
export function presentPublicHomeCover(
  cover: StoredHomeCover | null,
  resolveMediaUrl: ResolveMediaUrl,
): PublicHomeCover {
  if (!cover) return { cover: null };
  const scrim = homeCoverScrims(cover.analysis);
  const src = resolveMediaUrl(cover.mediaKey);
  if (!src || !scrim.desktop) return { cover: null };
  const { dominant, deepest, field, blurDataURL } = cover.analysis;
  return {
    cover: {
      src,
      width: cover.width,
      height: cover.height,
      ...(blurDataURL ? { blurDataURL } : {}),
      focal: cover.focal,
      zoom: 1,
      alt: cover.alt,
      side: homeCoverSide(cover.focal),
      analysisStatus: "ready",
      colours: { dominant, deepest, field },
      scrim: { desktop: scrim.desktop, wide: scrim.wide ?? null },
    },
  };
}

/** What LAX Admin shows for the cover: the picture, its words and what was measured. */
export function presentAdminHomeCover(
  cover: StoredHomeCover | null,
  resolveMediaUrl: ResolveMediaUrl,
): AdminHomeCover {
  const scrim = cover ? homeCoverScrims(cover.analysis) : null;
  const imageUrl = cover ? resolveMediaUrl(cover.mediaKey) : null;
  if (!cover || !scrim?.desktop || !imageUrl) {
    return { cover: null, minimumWidth: HOME_COVER_MIN_WIDTH };
  }
  return {
    cover: {
      mediaKey: cover.mediaKey,
      imageUrl,
      width: cover.width,
      height: cover.height,
      alt: cover.alt,
      focal: cover.focal,
      side: homeCoverSide(cover.focal),
      tone: scrim.desktop.tone,
      updatedAt: cover.updatedAt,
    },
    minimumWidth: HOME_COVER_MIN_WIDTH,
  };
}

/** What the public read gives the storefront; the catalogue routes depend on this alone. */
export interface PublicHomeCoverReader {
  read(): Promise<PublicHomeCover>;
}

/** The cover as LAX Admin's routes use it: every result already in the shape the screen reads. */
export type AdminHomeCoverPort = {
  read(): Promise<AdminHomeCover>;
  searchPictures(query: { q?: string; limit: number }): Promise<AdminHomeCoverPictureCandidates>;
  save(command: SaveHomeCoverCommand): Promise<AdminHomeCover>;
  clear(command: ClearHomeCoverCommand): Promise<AdminHomeCover>;
};

export function createPublicHomeCoverReader(
  service: Pick<HomeCoverService, "read">,
  resolveMediaUrl: ResolveMediaUrl,
): PublicHomeCoverReader {
  return { read: async () => presentPublicHomeCover(await service.read(), resolveMediaUrl) };
}

export function createAdminHomeCoverPort(
  service: HomeCoverService,
  resolveMediaUrl: ResolveMediaUrl,
): AdminHomeCoverPort {
  return {
    read: async () => presentAdminHomeCover(await service.read(), resolveMediaUrl),
    searchPictures: async (query) => ({ items: await service.searchPictures(query) }),
    save: async (command) => presentAdminHomeCover(await service.save(command), resolveMediaUrl),
    clear: async (command) => presentAdminHomeCover(await service.clear(command), resolveMediaUrl),
  };
}
