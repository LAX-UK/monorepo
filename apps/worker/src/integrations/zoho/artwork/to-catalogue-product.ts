import type { CatalogueArtist, CatalogueProduct } from "./catalogue-product.js";

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function lookup(value: unknown): { id: string; name: string | null } | null {
  if (typeof value === "string") {
    const id = text(value);
    return id ? { id, name: null } : null;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const id = text(record.id);
    return id ? { id, name: text(record.name) } : null;
  }
  return null;
}

function toYear(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed >= 1000 && parsed <= 2200 ? parsed : null;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Reads one row of the Artists module. Returns null when the row has no id or name. */
export function toCatalogueArtist(row: Record<string, unknown>): CatalogueArtist | null {
  const id = text(row.id);
  const name = text(row.Name) ?? text(row.Artist_Name);
  if (!id || !name) return null;
  return { id, name, code1: text(row.Artist_Code1), code2: text(row.Artist_Code2) };
}

/**
 * Reads one row of the Products module. The artist comes from the directory when it knows them;
 * otherwise from the name Zoho put on the lookup, so a missing directory never hides who it is.
 */
export function toCatalogueProduct(
  row: Record<string, unknown>,
  artists: ReadonlyMap<string, CatalogueArtist>,
): CatalogueProduct | null {
  const id = text(row.id);
  if (!id) return null;

  const artistLookup = lookup(row.Artist);
  const artist = artistLookup
    ? (artists.get(artistLookup.id) ??
      (artistLookup.name
        ? { id: artistLookup.id, name: artistLookup.name, code1: null, code2: null }
        : null))
    : null;

  return {
    id,
    modifiedAt: toDate(row.Modified_Time),
    title: text(row.Product_Name),
    stockCode: text(row.Reference_Stock_Code),
    artist,
    medium: text(row.Medium),
    dimensions: text(row.Dimensions),
    status: text(row.Status),
    year: toYear(row.Year),
    unitPrice: toNumber(row.Unit_Price),
  };
}
