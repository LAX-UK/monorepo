import { type AdminNewRunInput, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type ProofOwner,
  type ProofRun,
  type ProofType,
  ShopDomainError,
  assertProofListingApproved,
  assertValidEditionPlan,
  assertValidRunSpec,
  planEditionRun,
  proofListingSlug,
  proofListingTitle,
} from "@auction/shop-domain";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type { StoredEditionRun } from "../ports/edition-run.repository.js";
import type { EditionRunService } from "./create-edition-run.service.js";
import { mainRunSpec, newRunCommand, proofsKeptInput } from "./edition-run-input.js";
import type { EditionRunTx, EditionRunUnitOfWork, StaffCommand } from "./edition-run.ports.js";
import type { SaveEditionFactsService } from "./save-edition-facts.service.js";

const CAPABILITY = "catalogue.write";

type ListingAuthority = {
  /** `artwork_price.write`: a price can be set only with it. */
  canSetPrice: boolean;
  /** `hors_commerce.approve`: shop admins approve selling hors commerce proofs. */
  canApproveHorsCommerce: boolean;
};

export type ProofListingCommand = StaffCommand &
  ListingAuthority & {
    mainArtworkId: string;
    proofType: ProofType;
    count: number;
    owner: ProofOwner;
    printPricePence: number | null;
    horsCommerceApproved: boolean;
  };

export type CompanionListingCommand = StaffCommand &
  Pick<ListingAuthority, "canSetPrice"> & {
    mainArtworkId: string;
    slug: string;
    title: string;
    run: AdminNewRunInput;
    printPricePence: number | null;
  };

export type LinkedListingResult = { artworkId: string; slug: string; version: string };

function priceForbidden(): ShopApiError {
  return new ShopApiError(
    SHOP_API_ERROR_CODES.FORBIDDEN,
    "Setting an edition price needs price access",
    403,
  );
}

const HORS_COMMERCE_CAPABILITY = "hors_commerce.approve";

/**
 * Proof and companion listings: new artworks linked to a main run, with its title, images and
 * details copied. A proof listing sells some of the proofs the main run kept ("AP 1/3"), starts
 * with the main run's facts unconfirmed, and needs a shop admin's approval for hors commerce
 * proofs. A companion is another run of the same image, with its own run and facts.
 */
export function createLinkedListingService(deps: {
  uow: EditionRunUnitOfWork;
  runs: Pick<EditionRunService, "record">;
  facts: Pick<SaveEditionFactsService, "apply">;
}) {
  const { uow, runs, facts } = deps;

  async function loadMainRun(tx: EditionRunTx, mainArtworkId: string) {
    const main = await tx.prints.lockArtwork(mainArtworkId);
    if (!main) throw notFound("Artwork not found");
    const run: StoredEditionRun | null = await tx.runs.getRun(mainArtworkId);
    if (!run) throw new ShopDomainError("Only a run of prints can have linked listings");
    if (run.spec.type === "proof" || run.spec.type === "companion") {
      throw new ShopDomainError("Linked listings belong to a main run, not to another listing");
    }
    return { main, run };
  }

  return {
    createProofListing(command: ProofListingCommand): Promise<LinkedListingResult> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_listing.create_proof",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            if (command.printPricePence !== null && !command.canSetPrice) throw priceForbidden();
            assertProofListingApproved({
              proofType: command.proofType,
              approvedByShopAdmin: command.horsCommerceApproved && command.canApproveHorsCommerce,
            });
            const { main, run } = await loadMainRun(tx, command.mainArtworkId);
            const kept = run.proofsKept[command.proofType];
            const listed = await tx.prints.listedProofCount(main.artworkId, command.proofType);
            const spec: ProofRun = {
              type: "proof",
              proofType: command.proofType,
              size: command.count,
              owner: command.owner,
              mainRunId: main.artworkId,
              proofsKeptOnMain: Math.max(0, kept - listed),
            };
            if (kept === 0) {
              throw new ShopDomainError(
                "Record the proofs kept on the main run before listing any",
              );
            }
            assertValidRunSpec(spec);
            const listing = await tx.listings.copyFromMainRun({
              mainArtworkId: main.artworkId,
              slug: proofListingSlug(main.slug, command.proofType),
              onSlugTaken: "next_free",
              title: proofListingTitle(main.title, command.proofType),
              printPricePence: command.printPricePence,
            });
            const plan = planEditionRun(spec);
            assertValidEditionPlan(plan, spec);
            // The repository checks the proof count against the main run again, under its lock.
            await tx.runs.saveRun(listing.artworkId, {
              spec: { ...spec, proofsKeptOnMain: kept },
              proofsKept: proofsKeptInput(undefined),
            });
            await tx.prints.createPrints({
              artworkId: listing.artworkId,
              artistId: main.artistId,
              plan,
            });
            const mainFacts = await tx.facts.get(main.artworkId);
            if (mainFacts) {
              const { confirmed: _confirmed, ...copied } = mainFacts.facts;
              await facts.apply(tx, {
                artworkId: listing.artworkId,
                run: spec,
                facts: copied,
                confirmed: false,
                actorSubjectId: command.actorSubjectId,
              });
            }
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: command.proofType === "hc" ? HORS_COMMERCE_CAPABILITY : CAPABILITY,
              action: "create_proof_listing",
              targetType: "shop_artwork",
              targetId: listing.artworkId,
              afterJson: {
                mainArtworkId: main.artworkId,
                proofType: command.proofType,
                count: command.count,
                owner: command.owner,
                horsCommerceApproved: command.proofType === "hc",
              },
            });
            return { ...listing, version: await tx.prints.touch(listing.artworkId) };
          },
        }),
      );
    },

    createCompanionListing(command: CompanionListingCommand): Promise<LinkedListingResult> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_listing.create_companion",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            if (command.printPricePence !== null && !command.canSetPrice) throw priceForbidden();
            const { main } = await loadMainRun(tx, command.mainArtworkId);
            const listing = await tx.listings.copyFromMainRun({
              mainArtworkId: main.artworkId,
              slug: command.slug,
              onSlugTaken: "refuse",
              title: command.title,
              printPricePence: command.printPricePence,
            });
            const input = command.run;
            await runs.record(tx, {
              artwork: { artworkId: listing.artworkId, artistId: main.artistId },
              spec: {
                type: "companion",
                mainRunId: main.artworkId,
                run: mainRunSpec(input.spec, main.sourceOriginalArtworkId !== null),
              },
              command: newRunCommand(input),
              actorSubjectId: command.actorSubjectId,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: CAPABILITY,
              action: "create_companion_listing",
              targetType: "shop_artwork",
              targetId: listing.artworkId,
              afterJson: { mainArtworkId: main.artworkId, slug: listing.slug },
            });
            return { ...listing, version: await tx.prints.touch(listing.artworkId) };
          },
        }),
      );
    },
  };
}

export type LinkedListingService = ReturnType<typeof createLinkedListingService>;
