import type {
  ArtworkRegisterEntry,
  OfferRef,
  RegisterFieldValues,
  ZohoOwnedField,
} from "@auction/artwork-register-contracts";
import type {
  artworkRegister,
  artworkRegisterConflict,
  artworkRegisterEvent,
} from "@auction/db/schema";
import type { RegisterConflict, RegisterEvent } from "../../interfaces/artwork-register.js";

type RegisterRow = typeof artworkRegister.$inferSelect;
type RegisterColumns = Partial<typeof artworkRegister.$inferInsert>;

export function toEntry(row: RegisterRow): ArtworkRegisterEntry {
  const ref: OfferRef | null =
    row.offerRefKind && row.offerRefId ? { kind: row.offerRefKind, id: row.offerRefId } : null;
  return {
    id: row.id,
    zohoProductId: row.zohoProductId,
    stockCode: row.stockCode,
    kind: row.kind,
    sourceOriginalId: row.sourceOriginalId,
    title: row.title,
    artist: { zohoArtistId: row.artistZohoId, name: row.artistName, code: row.artistCode },
    medium: row.medium,
    dimensions: row.dimensions,
    year: row.year,
    imageRefs: row.imageRefs,
    catalogueStatus: row.catalogueStatus,
    zohoPrice: row.zohoPrice,
    offer: { state: row.offerState, ref },
    zohoModifiedAt: row.zohoModifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

/** Maps each Zoho-owned field to the columns that hold it, so a new field is one more entry. */
const ZOHO_FIELD_COLUMNS: {
  [F in ZohoOwnedField]: (value: RegisterFieldValues[F]) => RegisterColumns;
} = {
  title: (title) => ({ title }),
  artist: (artist) => ({
    artistZohoId: artist.zohoArtistId,
    artistName: artist.name,
    artistCode: artist.code,
  }),
  medium: (medium) => ({ medium }),
  dimensions: (dimensions) => ({ dimensions }),
  year: (year) => ({ year }),
  imageRefs: (imageRefs) => ({ imageRefs }),
  catalogueStatus: (catalogueStatus) => ({ catalogueStatus }),
  zohoPrice: (zohoPrice) => ({ zohoPrice }),
};

export function columnsForZohoFields(
  apply: Partial<Pick<RegisterFieldValues, ZohoOwnedField>>,
): RegisterColumns {
  let columns: RegisterColumns = {};
  for (const field of Object.keys(apply) as ZohoOwnedField[]) {
    const value = apply[field];
    if (value === undefined) continue;
    const toColumns = ZOHO_FIELD_COLUMNS[field] as (v: unknown) => RegisterColumns;
    columns = { ...columns, ...toColumns(value) };
  }
  return columns;
}

export function toEvent(row: typeof artworkRegisterEvent.$inferSelect): RegisterEvent {
  return { ...row };
}

export function toConflict(row: typeof artworkRegisterConflict.$inferSelect): RegisterConflict {
  return { ...row };
}
