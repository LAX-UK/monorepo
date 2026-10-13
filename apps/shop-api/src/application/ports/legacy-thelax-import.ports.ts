import type { EditorialBlock, SeoFields } from "@auction/shop-contracts";

/** Reads the normalized legacy export (crawl output or a CMS database dump). */
export interface LegacyThelaxExportSource {
  read(): Promise<unknown>;
}

export interface LegacyMediaFetcher {
  /** Returns `null` when the image is missing, too large, or not served from a legacy host. */
  fetch(url: string): Promise<Buffer | null>;
}

export type ImportedArtistProfile = {
  displayName: string;
  discipline: string | null;
  portraitImageUrl: string | null;
};

export type ImportedEditorialOutcome = "created" | "updated" | "kept_staff_edit";

/** Writes owned by the legacy importer; anything staff have since edited is left alone. */
export interface LegacyThelaxContentStore {
  /** `undefined` when no artwork has the slug; otherwise its import key (if any). */
  findArtworkImportKey(slug: string): Promise<string | null | undefined>;
  findArtist(slug: string): Promise<ImportedArtistProfile | null>;
  /** Creates the artist, or fills only the fields that are still empty. */
  ensureArtist(
    input: SeoFields & {
      slug: string;
      displayName: string;
      bio: string | null;
      portraitImageUrl: string | null;
    },
  ): Promise<"created" | "updated" | "unchanged">;
  upsertStory(
    input: SeoFields & {
      slug: string;
      title: string;
      standfirst: string | null;
      coverMediaKey: string | null;
      body: EditorialBlock[];
      actor: string;
    },
  ): Promise<ImportedEditorialOutcome>;
  upsertPage(
    input: SeoFields & { slug: string; title: string; body: EditorialBlock[]; actor: string },
  ): Promise<ImportedEditorialOutcome>;
}
