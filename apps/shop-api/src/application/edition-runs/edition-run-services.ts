import type { AdminNewRunInput } from "@auction/shop-contracts";
import type { ShopTransactionEffects } from "../ports/shop-unit-of-work.js";
import { createAddOpenEditionStockService } from "./add-open-edition-stock.service.js";
import { createEditionRunService } from "./create-edition-run.service.js";
import { createLinkedListingService } from "./create-linked-listing.service.js";
import { mainRunSpec, newRunCommand } from "./edition-run-input.js";
import type { Clock, EditionRunUnitOfWork } from "./edition-run.ports.js";
import { createSaveEditionFactsService } from "./save-edition-facts.service.js";

/** The four edition run use cases, wired to one unit of work. */
export function createEditionRunServices(deps: { uow: EditionRunUnitOfWork; clock: Clock }) {
  const facts = createSaveEditionFactsService(deps);
  const stock = createAddOpenEditionStockService(deps);
  const runs = createEditionRunService({ uow: deps.uow, facts, stock });
  const listings = createLinkedListingService({ uow: deps.uow, runs, facts });
  return {
    runs,
    facts,
    stock,
    listings,
    recorder: {
      /** The run of a new artwork, inside the transaction that creates the artwork. */
      recordNewRun: (effects: ShopTransactionEffects, input: NewArtworkRun) =>
        runs.record(deps.uow.bind(effects), {
          artwork: { artworkId: input.artworkId, artistId: input.artistId },
          spec: mainRunSpec(input.run.spec, input.sourceOriginalArtworkId !== null),
          command: newRunCommand(input.run),
          actorSubjectId: input.actorSubjectId,
        }),
    } satisfies EditionRunRecorder,
  };
}

export type NewArtworkRun = {
  artworkId: string;
  artistId: string;
  sourceOriginalArtworkId: string | null;
  run: AdminNewRunInput;
  actorSubjectId: string;
};

/** What the artwork writer needs to give a new artwork its run, in its own transaction. */
export interface EditionRunRecorder {
  recordNewRun(effects: ShopTransactionEffects, input: NewArtworkRun): Promise<number>;
}

export type EditionRunServices = ReturnType<typeof createEditionRunServices>;
