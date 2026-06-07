import { type ArtistKind, artistKinds } from "./artist.js";

/**
 * Central creator-kind configuration registry.
 *
 * This is the single source of truth that makes the creator entity "depend on
 * the kind". Validators, the admin form, and the public marketing pages all
 * read from here instead of branching on literal kinds (OCP): adding a new
 * kind means adding one entry below (+ one `ALTER TYPE ADD VALUE` migration)
 * and nothing else changes.
 *
 * The config is split into focused capability slices (ISP):
 *  - presentation:  labels + lifespan mode (consumed by admin form + marketing)
 *  - seo:           schema.org type (consumed by structured-data only)
 *  - attributes:    declarative field spec (drives form, display, AND zod)
 */

/** How a kind expresses its lifespan, which drives field labels and the
 * living/historical facet semantics. */
export type CreatorLifespanMode = "person" | "organisation";

/** schema.org type used when emitting JSON-LD for a creator profile. */
export type CreatorSchemaOrgType =
  | "VisualArtist"
  | "Person"
  | "Brand"
  | "Organization"
  | "Manufacturer";

/** Input control for a kind-specific attribute. */
export type CreatorAttributeType = "text" | "textarea" | "year" | "url";

/** Declarative spec for a single kind-specific attribute. Drives the admin
 * input, the public display row, and the zod validation schema. */
export type CreatorAttributeField = {
  /** Stable key persisted inside `artist_profile.attributes` JSONB. */
  key: string;
  label: string;
  type: CreatorAttributeType;
  maxLength?: number;
  /** Optional helper text shown under the admin input. */
  help?: string;
};

export type CreatorKindConfig = {
  kind: ArtistKind;
  /** Singular label, e.g. "Marque". */
  label: string;
  /** Plural label, e.g. "Marques". */
  pluralLabel: string;
  /** Person vs organisation lifespan semantics. */
  lifespanMode: CreatorLifespanMode;
  /** schema.org type for structured data. */
  schemaOrgType: CreatorSchemaOrgType;
  /** Human-facing department hints (used to guide category selection in admin). */
  departmentHints: readonly string[];
  /** Kind-specific attribute fields. */
  attributes: readonly CreatorAttributeField[];
};

const text = (key: string, label: string, help?: string): CreatorAttributeField => ({
  key,
  label,
  type: "text",
  maxLength: 200,
  ...(help ? { help } : {}),
});

const longText = (key: string, label: string, help?: string): CreatorAttributeField => ({
  key,
  label,
  type: "textarea",
  maxLength: 2000,
  ...(help ? { help } : {}),
});

export const CREATOR_KIND_CONFIG: Record<ArtistKind, CreatorKindConfig> = {
  artist: {
    kind: "artist",
    label: "Artist",
    pluralLabel: "Artists",
    lifespanMode: "person",
    schemaOrgType: "VisualArtist",
    departmentHints: ["Fine Art", "Prints & Multiples", "Photographs"],
    attributes: [
      text("movement", "Art movement", "e.g. Impressionism, Cubism"),
      text("medium", "Primary medium", "e.g. Oil on canvas, Bronze"),
      text("education", "Education / training"),
    ],
  },
  maker: {
    kind: "maker",
    label: "Maker",
    pluralLabel: "Makers",
    lifespanMode: "person",
    schemaOrgType: "Person",
    departmentHints: ["Design", "Decorative Arts", "Jewellery"],
    attributes: [
      text("discipline", "Discipline", "e.g. Ceramicist, Silversmith"),
      text("materials", "Signature materials"),
    ],
  },
  designer: {
    kind: "designer",
    label: "Designer",
    pluralLabel: "Designers",
    lifespanMode: "person",
    schemaOrgType: "Person",
    departmentHints: ["Design", "Decorative Arts"],
    attributes: [
      text("discipline", "Discipline", "e.g. Furniture, Industrial"),
      longText("notableWorks", "Notable works"),
    ],
  },
  studio: {
    kind: "studio",
    label: "Studio / Workshop",
    pluralLabel: "Studios & Workshops",
    lifespanMode: "organisation",
    schemaOrgType: "Organization",
    departmentHints: ["Design", "Decorative Arts", "Fine Art"],
    attributes: [text("foundedLocation", "Founded in"), text("principals", "Principal members")],
  },
  brand: {
    kind: "brand",
    label: "Brand",
    pluralLabel: "Brands",
    lifespanMode: "organisation",
    schemaOrgType: "Brand",
    departmentHints: ["Watches", "Jewellery", "Handbags & Accessories"],
    attributes: [text("headquarters", "Headquarters"), text("parentCompany", "Parent company")],
  },
  marque: {
    kind: "marque",
    label: "Marque",
    pluralLabel: "Marques",
    lifespanMode: "organisation",
    schemaOrgType: "Brand",
    departmentHints: ["Motor Cars", "Automobilia", "Motorcycles"],
    attributes: [
      text("countryOfOrigin", "Country of origin"),
      text("founderName", "Founder"),
      text("parentCompany", "Parent company"),
      text("status", "Status", "e.g. Active, Defunct"),
    ],
  },
  manufacturer: {
    kind: "manufacturer",
    label: "Manufacturer",
    pluralLabel: "Manufacturers",
    lifespanMode: "organisation",
    schemaOrgType: "Manufacturer",
    departmentHints: ["Watches", "Design", "Motor Cars", "Instruments"],
    attributes: [text("headquarters", "Headquarters"), text("parentCompany", "Parent company")],
  },
  coachbuilder: {
    kind: "coachbuilder",
    label: "Coachbuilder",
    pluralLabel: "Coachbuilders",
    lifespanMode: "organisation",
    schemaOrgType: "Organization",
    departmentHints: ["Motor Cars", "Automobilia"],
    attributes: [text("countryOfOrigin", "Country of origin"), text("founderName", "Founder")],
  },
  author: {
    kind: "author",
    label: "Author",
    pluralLabel: "Authors",
    lifespanMode: "person",
    schemaOrgType: "Person",
    departmentHints: ["Books & Manuscripts", "Literature"],
    attributes: [
      text("penNames", "Pen names"),
      text("languages", "Languages"),
      text("genres", "Genres"),
    ],
  },
  publisher: {
    kind: "publisher",
    label: "Publisher",
    pluralLabel: "Publishers",
    lifespanMode: "organisation",
    schemaOrgType: "Organization",
    departmentHints: ["Books & Manuscripts"],
    attributes: [text("headquarters", "Headquarters"), text("foundedLocation", "Founded in")],
  },
  printer: {
    kind: "printer",
    label: "Printer / Press",
    pluralLabel: "Printers & Presses",
    lifespanMode: "organisation",
    schemaOrgType: "Organization",
    departmentHints: ["Books & Manuscripts"],
    attributes: [text("pressName", "Press name"), text("location", "Location")],
  },
  mint: {
    kind: "mint",
    label: "Mint",
    pluralLabel: "Mints",
    lifespanMode: "organisation",
    schemaOrgType: "Organization",
    departmentHints: ["Coins & Medals", "Numismatics"],
    attributes: [
      text("mintMarks", "Mint marks"),
      text("location", "Location"),
      text("region", "Region"),
    ],
  },
  issuing_authority: {
    kind: "issuing_authority",
    label: "Issuing authority",
    pluralLabel: "Issuing authorities",
    lifespanMode: "organisation",
    schemaOrgType: "Organization",
    departmentHints: ["Coins & Medals", "Numismatics", "Banknotes"],
    attributes: [
      text("authorityType", "Authority type", "e.g. Monarch, State, Central bank"),
      text("region", "Region"),
      text("era", "Era"),
    ],
  },
  producer: {
    kind: "producer",
    label: "Producer / Estate",
    pluralLabel: "Producers & Estates",
    lifespanMode: "organisation",
    schemaOrgType: "Organization",
    departmentHints: ["Design & Decorative Arts", "Books & Manuscripts"],
    attributes: [text("region", "Region"), text("estate", "Estate / atelier")],
  },
};

/** Single typed entry point. Falls back to the `artist` config for unknown
 * kinds so callers never crash on legacy/unexpected values (LSP-safe). */
export function getCreatorKindConfig(kind: ArtistKind | null | undefined): CreatorKindConfig {
  if (kind && kind in CREATOR_KIND_CONFIG) {
    return CREATOR_KIND_CONFIG[kind];
  }
  return CREATOR_KIND_CONFIG.artist;
}

/** All kinds whose lifespan is expressed as founded/dissolved (organisations). */
export function isOrganisationKind(kind: ArtistKind | null | undefined): boolean {
  return getCreatorKindConfig(kind).lifespanMode === "organisation";
}

/** Convenience list for building option menus, ordered as declared. */
export const creatorKindConfigList: readonly CreatorKindConfig[] = artistKinds.map(
  (kind) => CREATOR_KIND_CONFIG[kind],
);
