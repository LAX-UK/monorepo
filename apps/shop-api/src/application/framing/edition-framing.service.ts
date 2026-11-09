import {
  type AdminEditionFraming,
  type AdminEditionFramingSaveBody,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import {
  FRAMING_EDIT_CAPABILITY,
  editionFramingIssues,
  isBuyerOffered,
} from "@auction/shop-domain";
import { EditionFramingRejectedError } from "../../errors/edition-framing-rejected-error.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type {
  CatalogueOptionFacts,
  EditionFramingFacts,
  EditionFramingTx,
  EditionFramingUnitOfWork,
} from "./edition-framing.ports.js";
import { editionBand } from "./edition-framing.view.js";

export type SaveEditionFramingCommand = {
  artworkId: string;
  body: AdminEditionFramingSaveBody;
  actorSubjectId: string;
  idempotencyKey: string;
  /** Whether the staff member may set an edition's own prices (artwork_price.write). */
  maySetPrices: boolean;
};

const TARGET_TYPE = "shop_artwork";

function present(
  facts: EditionFramingFacts,
  catalogue: readonly CatalogueOptionFacts[],
): AdminEditionFraming {
  const band = editionBand(facts);
  const offers = new Map(facts.offers.map((offer) => [offer.optionId, offer]));
  return {
    artworkId: facts.artworkId,
    mode: facts.mode,
    framedByArtist: facts.framedByArtist,
    sheetSize: facts.sheetSize,
    band,
    options: catalogue.map((option) => {
      const offer = offers.get(option.optionId);
      return {
        optionId: option.optionId,
        name: option.name,
        frame: option.frame,
        mount: option.mount,
        glazing: option.glazing,
        hanging: option.hanging,
        leadTimeMinDays: option.leadTimeMinDays,
        leadTimeMaxDays: option.leadTimeMaxDays,
        catalogueStatus: option.status,
        placeholderBands: [...option.placeholderBands],
        cataloguePricePence: band ? option.pricesPence[band] : null,
        offered: offer !== undefined,
        overridePence: offer?.overridePence ?? null,
        offerable: isBuyerOffered(option),
      };
    }),
    version: facts.settingsUpdatedAt?.toISOString() ?? null,
  };
}

function summary(facts: EditionFramingFacts) {
  return {
    mode: facts.mode,
    framedByArtist: facts.framedByArtist,
    offers: facts.offers.map((offer) => ({
      optionId: offer.optionId,
      overridePence: offer.overridePence,
    })),
  };
}

/**
 * Framing on an edition, in LAX Admin: reads how an edition is sold with respect to framing and
 * saves it whole (the mode, the artist's frame in words, the offered options and each edition's
 * own prices). A save is checked by the domain rules, audited with the settings before and after,
 * replayed for a repeated idempotency key, and refused if the settings changed since they were
 * opened. Setting an edition's own price is money, so it needs the price capability as well.
 */
export function createEditionFramingService(deps: { uow: EditionFramingUnitOfWork }) {
  async function readWith(tx: EditionFramingTx, artworkId: string) {
    if (!(await tx.framing.lockEdition(artworkId))) throw notFound("Artwork not found");
    const [facts, catalogue] = await Promise.all([
      tx.framing.facts(artworkId),
      tx.framing.catalogue(),
    ]);
    return { facts, catalogue };
  }

  return {
    get(artworkId: string): Promise<AdminEditionFraming> {
      return deps.uow.run(async (tx) => {
        const { facts, catalogue } = await readWith(tx, artworkId);
        return present(facts, catalogue);
      });
    },

    save(command: SaveEditionFramingCommand): Promise<AdminEditionFraming> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_framing.save",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { artworkId: command.artworkId, ...command.body },
          run: async () => {
            const { body } = command;
            const { facts: before, catalogue } = await readWith(tx, command.artworkId);
            const held = before.settingsUpdatedAt?.toISOString() ?? null;
            // Versions travel as millisecond ISO strings; the column holds microseconds.
            const sameVersion =
              held === null
                ? body.expectedVersion === null
                : body.expectedVersion !== null &&
                  new Date(held).getTime() === new Date(body.expectedVersion).getTime();
            if (!sameVersion) throw new StaleVersionError("This edition's framing", held ?? "");

            const savedPrices = new Map(
              before.offers.map((offer) => [offer.optionId, offer.overridePence]),
            );
            const changesPrice = body.offers.some(
              (offer) => (savedPrices.get(offer.optionId) ?? null) !== offer.overridePence,
            );
            if (changesPrice && !command.maySetPrices) {
              throw new ShopApiError(
                SHOP_API_ERROR_CODES.FORBIDDEN,
                "Setting an edition's own framing price needs the price permission.",
                403,
              );
            }

            const issues = editionFramingIssues(
              {
                mode: body.mode,
                framedByArtist: body.framedByArtist,
                offers: body.offers,
              },
              {
                band: editionBand(before),
                options: new Map(catalogue.map((option) => [option.optionId, option])),
                savedOptionIds: new Set(savedPrices.keys()),
              },
            );
            const known = new Set(catalogue.map((option) => option.optionId));
            const unknown = body.offers.filter((offer) => !known.has(offer.optionId));
            if (issues.length > 0 || unknown.length > 0) {
              throw new EditionFramingRejectedError([
                ...issues,
                ...unknown.map((offer) => ({
                  field: `option:${offer.optionId}` as const,
                  reason: "option_not_offerable" as const,
                })),
              ]);
            }

            await tx.framing.replace({
              artworkId: command.artworkId,
              mode: body.mode,
              framedByArtist: body.mode === "framed_by_artist" ? body.framedByArtist.trim() : null,
              offers: body.mode === "framed_by_artist" ? [] : body.offers,
            });
            const { facts: after } = await readWith(tx, command.artworkId);
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: FRAMING_EDIT_CAPABILITY,
              action: "edition_framing.save",
              targetType: TARGET_TYPE,
              targetId: command.artworkId,
              beforeJson: summary(before),
              afterJson: summary(after),
            });
            return present(after, catalogue);
          },
        }),
      );
    },
  };
}

export type EditionFramingService = ReturnType<typeof createEditionFramingService>;
