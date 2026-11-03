/** An artist in the Zoho Artists module, as the catalogue needs them. */
export type CatalogueArtist = {
  id: string;
  name: string;
  /** Artist_Code1 and Artist_Code2 as typed in Zoho. */
  code1: string | null;
  code2: string | null;
};

/**
 * One Zoho CRM Product read for the artwork register: plain values, with the artist already
 * looked up. Nothing here depends on how Zoho spells its fields.
 */
export type CatalogueProduct = {
  id: string;
  /** Zoho's Modified_Time, or null when Zoho sent none we can read. */
  modifiedAt: Date | null;
  title: string | null;
  /** Reference_Stock_Code as typed in Zoho, trimmed; not yet checked against the LAX shape. */
  stockCode: string | null;
  artist: CatalogueArtist | null;
  medium: string | null;
  dimensions: string | null;
  status: string | null;
  year: number | null;
  unitPrice: number | null;
};

/** Artists whose name starts with this are test data and never enter the register. */
export const DEMO_ARTIST_PREFIX = "DEMO - ";

export function isDemoArtist(artist: CatalogueArtist | null): boolean {
  return artist?.name.startsWith(DEMO_ARTIST_PREFIX) === true;
}
