import type {
  FramingBandCode,
  FramingFrame,
  FramingGlazing,
  FramingHanging,
  FramingMode,
  FramingMount,
  FramingPrices,
  FramingStatus,
} from "@auction/shop-domain";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "../ports/shop-admin-command.writer.js";

/** A catalogue option as an edition sees it: the option itself and the edition's own price. */
export type EditionFramingOfferFacts = {
  optionId: string;
  name: string;
  frame: FramingFrame;
  mount: FramingMount;
  glazing: FramingGlazing;
  hanging: FramingHanging;
  leadTimeMinDays: number;
  leadTimeMaxDays: number;
  status: FramingStatus;
  placeholderBands: readonly FramingBandCode[];
  pricesPence: FramingPrices;
  /** The edition's own price in place of the catalogue's, null when it uses the catalogue's. */
  overridePence: number | null;
};

/** Everything that decides what framing an edition shows and charges. */
export type EditionFramingFacts = {
  artworkId: string;
  mode: FramingMode;
  framedByArtist: string;
  /** The sheet size as catalogued; sets the size band. */
  sheetSize: string | null;
  offers: readonly EditionFramingOfferFacts[];
  /** When the edition's framing settings were last saved; null while it has none. */
  settingsUpdatedAt: Date | null;
};

/** Reads the framing facts of editions, for the buyer's page, the basket and checkout. */
export interface EditionFramingReader {
  read(artworkIds: readonly string[]): Promise<Map<string, EditionFramingFacts>>;
  /** The facts of a publicly visible edition by its slug; null when there is none. */
  readBySlug(slug: string): Promise<EditionFramingFacts | null>;
  /** Catalogue options by id, offered by an edition or not, for a basket line to describe. */
  options(optionIds: readonly string[]): Promise<Map<string, CatalogueOptionFacts>>;
}

/** An option in the catalogue, whether or not the edition offers it. */
export type CatalogueOptionFacts = Omit<EditionFramingOfferFacts, "overridePence">;

/** What a save looks up and writes, inside its transaction. */
export interface EditionFramingStore {
  /** Holds the edition's framing until the transaction ends; false if the edition is unknown. */
  lockEdition(artworkId: string): Promise<boolean>;
  facts(artworkId: string): Promise<EditionFramingFacts>;
  catalogue(): Promise<CatalogueOptionFacts[]>;
  /** Replaces the settings and the offered options in one go. */
  replace(input: {
    artworkId: string;
    mode: FramingMode;
    framedByArtist: string | null;
    offers: readonly { optionId: string; overridePence: number | null }[];
  }): Promise<void>;
}

export type EditionFramingTx = {
  framing: EditionFramingStore;
  audit: ShopAdminAuditWriter;
  commands: ShopAdminCommandWriter;
};

export interface EditionFramingUnitOfWork {
  run<T>(fn: (tx: EditionFramingTx) => Promise<T>): Promise<T>;
}
