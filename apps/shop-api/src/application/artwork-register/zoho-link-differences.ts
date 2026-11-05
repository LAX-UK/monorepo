import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { AdminZohoLinkDifference, AdminZohoLinkField } from "@auction/shop-contracts";

/** The facts of the lax.art original that a link can change. */
export type LinkListingFacts = {
  title: string;
  artistId: string;
  artistName: string;
  /** The Zoho artist code the listing's artist carries; null when it has none. */
  artistCode: string | null;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  /** Image keys in display order. */
  imageKeys: readonly string[];
};

/** The lax.art artist that carries the register record's Zoho artist code, if any. */
export type ArtistForCode = { artistId: string; displayName: string; archived: boolean } | null;

/** What linking writes to the listing. Only fields that differ are present. The web address never is. */
export type LinkUpdate = {
  title?: string;
  medium?: string | null;
  dimensions?: string | null;
  yearCreated?: number | null;
  /** Zoho's images, replacing the listing's. */
  images?: string[];
  /** The artist moves to the lax.art artist that carries Zoho's artist code. */
  artistId?: string;
  /** The listing's own artist has no Zoho code yet and takes Zoho's. */
  claimArtistCode?: string;
};

export type LinkPlan = {
  differences: AdminZohoLinkDifference[];
  update: LinkUpdate;
  /** Set when the link cannot be made because of the artist; staff fix the artist first. */
  artistRefusal: string | null;
  /** The fields Zoho's value replaced, for the record in history. */
  replaced: AdminZohoLinkField[];
};

const clean = (value: string | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

const sameName = (a: string, b: string) =>
  a
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase() ===
  b
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();

const imageCount = (keys: readonly string[]) =>
  keys.length === 0 ? null : keys.length === 1 ? "1 image" : `${keys.length} images`;

/**
 * What linking this lax.art original to this register record would change. Zoho is master: where
 * the two disagree, Zoho's value replaces lax.art's, including a value Zoho leaves empty (the
 * nightly sync of linked listings does the same, so the link does not promise more than it keeps).
 * The artist follows Zoho's artist code. Pure: the same inputs give the same plan.
 */
export function planLink(
  listing: LinkListingFacts,
  entry: ArtworkRegisterEntry,
  artistForCode: ArtistForCode,
): LinkPlan {
  const differences: AdminZohoLinkDifference[] = [];
  const update: LinkUpdate = {};
  let artistRefusal: string | null = null;

  const text = (
    field: "title" | "medium" | "size",
    label: string,
    zoho: string | null,
    laxArt: string | null,
    set: (value: string | null) => void,
  ) => {
    const zohoValue = clean(zoho);
    const laxArtValue = clean(laxArt);
    if (zohoValue === laxArtValue) return;
    differences.push({ field, label, zohoValue, laxArtValue });
    set(zohoValue);
  };

  text("title", "Title", entry.title, listing.title, (value) => {
    if (value !== null) update.title = value;
  });

  // Artist: by Zoho's artist code.
  const zohoCode = entry.artist.code.trim().toUpperCase();
  const listingCode = listing.artistCode?.trim().toUpperCase() ?? null;
  if (listingCode !== zohoCode) {
    if (artistForCode && !artistForCode.archived) {
      if (artistForCode.artistId !== listing.artistId) {
        differences.push({
          field: "artist",
          label: "Artist",
          zohoValue: artistForCode.displayName,
          laxArtValue: listing.artistName,
        });
        update.artistId = artistForCode.artistId;
      }
    } else if (artistForCode?.archived) {
      artistRefusal = `The lax.art artist for Zoho artist code ${entry.artist.code} (${artistForCode.displayName}) is archived. Restore the artist first.`;
    } else if (listingCode === null && sameName(listing.artistName, entry.artist.name)) {
      // The same person, whose artist record just has not been given Zoho's code yet.
      update.claimArtistCode = entry.artist.code;
    } else {
      artistRefusal = `No lax.art artist has Zoho artist code ${entry.artist.code} (${entry.artist.name}), and this artwork's artist is ${listing.artistName}. Add the code to the right artist first.`;
    }
  }

  text("medium", "Medium", entry.medium, listing.medium, (value) => {
    update.medium = value;
  });
  text("size", "Size", entry.dimensions, listing.dimensions, (value) => {
    update.dimensions = value;
  });

  if (entry.year !== listing.year) {
    differences.push({
      field: "year",
      label: "Year",
      zohoValue: entry.year === null ? null : String(entry.year),
      laxArtValue: listing.year === null ? null : String(listing.year),
    });
    update.yearCreated = entry.year;
  }

  const zohoImages = [...new Set(entry.imageRefs)];
  if (zohoImages.join("\n") !== listing.imageKeys.join("\n")) {
    differences.push({
      field: "images",
      label: "Images",
      zohoValue: imageCount(zohoImages),
      laxArtValue: imageCount(listing.imageKeys),
    });
    update.images = zohoImages;
  }

  return {
    differences,
    update,
    artistRefusal,
    replaced: differences.map((difference) => difference.field),
  };
}
