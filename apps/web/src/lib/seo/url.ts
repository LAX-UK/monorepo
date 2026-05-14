type SlugifyOptions = {
  maxLength?: number;
  fallback?: string;
};

type LotUrlFields = {
  id: string;
  title: string;
};

type SaleUrlFields = {
  id: string;
  title: string;
};

type ArtistUrlFields = {
  id: string;
  name: string;
};

const DEFAULT_MAX_LENGTH = 60;

function trimToWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  const truncated = value.slice(0, maxLength);
  const lastHyphen = truncated.lastIndexOf("-");
  if (lastHyphen > 0) return truncated.slice(0, lastHyphen);
  return truncated;
}

export function slugify(input: string, opts: SlugifyOptions = {}): string {
  const maxLength = Math.max(1, opts.maxLength ?? DEFAULT_MAX_LENGTH);
  const fallback = opts.fallback ?? "untitled";
  const normalized = input
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  const bounded = trimToWordBoundary(normalized, maxLength).replace(/^-+|-+$/g, "");
  if (bounded) return bounded;
  return slugify(fallback, { maxLength, fallback: "untitled" });
}

export function lotPath(lot: LotUrlFields): string {
  return `/lot/${slugify(lot.title)}/${lot.id}`;
}

export function salePath(sale: SaleUrlFields): string {
  return `/sales/${slugify(sale.title)}/${sale.id}`;
}

export function artistPath(artist: ArtistUrlFields): string {
  return `/artist/${slugify(artist.name)}/${artist.id}`;
}

export const urlForLot = lotPath;
export const urlForSale = salePath;
export const urlForArtist = artistPath;
