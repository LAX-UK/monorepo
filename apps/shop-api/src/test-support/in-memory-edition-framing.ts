import type {
  CatalogueOptionFacts,
  EditionFramingFacts,
  EditionFramingOfferFacts,
  EditionFramingReader,
  EditionFramingTx,
} from "../application/framing/edition-framing.ports.js";
import { createEditionFramingService } from "../application/framing/edition-framing.service.js";
import type { ShopAdminAuditRecord } from "../application/ports/shop-admin-audit.writer.js";

export const ARTWORK = "00000000-0000-4000-8000-0000000000b1";

const REAL_PRICES = { up_to_40x50: 12000, up_to_60x80: 19500, up_to_80x100: 26000 };

/** A catalogue option ready for buyers: offered, with every price the framer's. */
export function liveOption(
  id: string,
  overrides: Partial<CatalogueOptionFacts> = {},
): CatalogueOptionFacts {
  return {
    optionId: id,
    name: `Option ${id.slice(-2)}`,
    frame: "natural_oak",
    mount: "window_conservation",
    glazing: "uv_acrylic",
    hanging: "d_rings_cord",
    leadTimeMinDays: 10,
    leadTimeMaxDays: 15,
    status: "active",
    placeholderBands: [],
    pricesPence: REAL_PRICES,
    ...overrides,
  };
}

export const OAK = "00000000-0000-4000-8000-0000000000a1";
export const BLACK = "00000000-0000-4000-8000-0000000000a2";
export const WALNUT = "00000000-0000-4000-8000-0000000000a3";

/** Facts for an edition with a 50 x 70 cm sheet (the 60 x 80 band) and the given offers. */
export function editionFacts(
  overrides: Partial<EditionFramingFacts> = {},
  offers: readonly { option: CatalogueOptionFacts; overridePence?: number | null }[] = [],
): EditionFramingFacts {
  const offerFacts: EditionFramingOfferFacts[] = offers.map(({ option, overridePence }) => ({
    ...option,
    overridePence: overridePence ?? null,
  }));
  return {
    artworkId: ARTWORK,
    mode: "unframed_or_framed",
    framedByArtist: "",
    sheetSize: "50 × 70 cm",
    offers: offerFacts,
    settingsUpdatedAt: null,
    ...overrides,
  };
}

/** A reader over fixed facts, for the buyer's page and the basket. */
export function fixedFramingReader(
  facts: EditionFramingFacts | null,
  catalogue: readonly CatalogueOptionFacts[] = [],
): EditionFramingReader {
  return {
    read: async (ids) =>
      facts && ids.includes(facts.artworkId) ? new Map([[facts.artworkId, facts]]) : new Map(),
    readBySlug: async () => facts,
    options: async (ids) =>
      new Map(
        catalogue.filter((option) => ids.includes(option.optionId)).map((o) => [o.optionId, o]),
      ),
  };
}

/**
 * An edition's framing over one in-memory store: the catalogue, the edition's settings, the audit
 * trail and replayable commands. The real service runs on top, so tests exercise its rules.
 */
export function createInMemoryEditionFraming(options: {
  catalogue: CatalogueOptionFacts[];
  sheetSize?: string | null;
  known?: boolean;
  now?: () => Date;
  initial?: {
    mode: EditionFramingFacts["mode"];
    framedByArtist?: string;
    offers: { optionId: string; overridePence: number | null }[];
  };
}) {
  let current = editionFacts(
    { sheetSize: options.sheetSize === undefined ? "50 × 70 cm" : options.sheetSize },
    [],
  );
  const catalogue = options.catalogue;
  const now = options.now ?? (() => new Date("2026-11-02T12:00:00.000Z"));
  const audit: ShopAdminAuditRecord[] = [];
  const completed = new Map<string, unknown>();

  const withOffers = (offers: readonly { optionId: string; overridePence: number | null }[]) =>
    offers.flatMap(({ optionId, overridePence }) => {
      const option = catalogue.find((candidate) => candidate.optionId === optionId);
      return option ? [{ ...option, overridePence }] : [];
    });

  if (options.initial) {
    current = {
      ...current,
      mode: options.initial.mode,
      framedByArtist: options.initial.framedByArtist ?? "",
      offers: withOffers(options.initial.offers),
      settingsUpdatedAt: new Date("2026-11-01T09:00:00.000Z"),
    };
  }

  const tx: EditionFramingTx = {
    framing: {
      lockEdition: async () => options.known ?? true,
      facts: async () => current,
      catalogue: async () => catalogue,
      replace: async (input) => {
        current = {
          ...current,
          mode: input.mode,
          framedByArtist: input.framedByArtist ?? "",
          offers: withOffers(input.offers),
          settingsUpdatedAt: now(),
        };
      },
    },
    audit: {
      append: async (record) => {
        audit.push(record);
      },
    },
    commands: {
      begin: async ({ idempotencyKey }) =>
        completed.has(idempotencyKey)
          ? { kind: "replay", result: completed.get(idempotencyKey) }
          : { kind: "started" },
      complete: async ({ idempotencyKey, result }) => {
        completed.set(idempotencyKey, result);
      },
    },
  };

  const service = createEditionFramingService({ uow: { run: (fn) => fn(tx) } });
  return { service, audit, facts: () => current };
}
