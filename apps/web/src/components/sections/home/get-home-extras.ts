import "server-only";

import { fetchPublicArtistBrowse } from "@/lib/data/http/artist.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerPressArchiveReader } from "@/lib/data/http/press.server";
import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import type { HomeSectionId } from "@auction/domain";
import type { Category, PressArchiveEntry, PublicArtistDirectoryRow } from "@auction/types";

/** What the departments, artists and press sections read, and only for the sections on the page. */
export type HomeExtras = {
  categories: Category[];
  artists: PublicArtistDirectoryRow[];
  press: PressArchiveEntry[];
};

async function settled<T>(label: string, read: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await read();
  } catch (err) {
    console.error(`[getHomeExtras] ${label} failed`, err);
    return empty;
  }
}

/** A failed read leaves its section out; it never fails the page. */
export async function getHomeExtras(sections: readonly HomeSectionId[]): Promise<HomeExtras> {
  const wants = (id: HomeSectionId) => sections.includes(id);
  const [categories, artists, press] = await Promise.all([
    wants("departments")
      ? settled(
          "categories",
          async () => (await getServerCategoryReader()).listWithPublishedLots(),
          [],
        )
      : [],
    wants("artists")
      ? settled(
          "artists",
          async () =>
            (
              await fetchPublicArtistBrowse({
                limit: HOME_SECTION_LIMITS.artists.max * 3,
                featuredFirst: true,
              })
            ).rows,
          [],
        )
      : [],
    wants("fromLaxAndPress")
      ? settled(
          "press",
          async () =>
            (await getServerPressArchiveReader().list({ limit: HOME_SECTION_LIMITS.press.max }))
              .data,
          [],
        )
      : [],
  ]);
  return { categories, artists, press };
}
