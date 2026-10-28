import type { AdminMainRunInput } from "@auction/shop-contracts";
import {
  type EditionRunSpec,
  type MainRunSpec,
  type ProofsKept,
  ShopDomainError,
  assertEditionFacts,
  assertRunSizeEditable,
  assertValidEditionPlan,
  planEditionRun,
} from "@auction/shop-domain";
import { notFound } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type { AddOpenEditionStockService } from "./add-open-edition-stock.service.js";
import { type NewRunCommand, mainRunSpec } from "./edition-run-input.js";
import type {
  EditionRunTx,
  EditionRunUnitOfWork,
  RunArtwork,
  StaffCommand,
} from "./edition-run.ports.js";
import type { SaveEditionFactsService } from "./save-edition-facts.service.js";

const CAPABILITY = "catalogue.write";

export type RecordRunInput = {
  artwork: Pick<RunArtwork, "artworkId" | "artistId">;
  /** A main run, or a companion wrapping one; proof listings are made by CreateLinkedListing. */
  spec: EditionRunSpec;
  command: Omit<NewRunCommand, "spec">;
  actorSubjectId: string;
};

export type ReplaceRunCommand = StaffCommand & {
  artworkId: string;
  run: AdminMainRunInput;
  proofsKept: ProofsKept;
  expectedVersion: string;
};

function sameRun(a: EditionRunSpec, b: EditionRunSpec): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function withMain(current: EditionRunSpec, main: MainRunSpec): EditionRunSpec {
  return current.type === "companion" ? { ...current, run: main } : main;
}

/**
 * Records the run an artwork sells and creates its prints: LAX standard (24, split 10 / 10 / 4),
 * a custom limited run, or an open edition with its first batch. While no print has been offered
 * for sale, the run can be replaced; after that its size and allocation are fixed (rule 13).
 */
export function createEditionRunService(deps: {
  uow: EditionRunUnitOfWork;
  facts: Pick<SaveEditionFactsService, "apply">;
  stock: Pick<AddOpenEditionStockService, "apply">;
}) {
  const { uow, facts, stock } = deps;

  /** On a new artwork, inside the transaction that created it. Returns how many prints exist. */
  async function record(tx: EditionRunTx, input: RecordRunInput): Promise<number> {
    const { artwork, spec, command } = input;
    if (spec.type === "proof") {
      throw new ShopDomainError("Proof listings are created from their main run");
    }
    const plan = planEditionRun(spec);
    assertValidEditionPlan(plan, spec);
    await tx.runs.saveRun(artwork.artworkId, { spec, proofsKept: command.proofsKept });
    let printCount = await tx.prints.createPrints({ ...artwork, plan });
    if (command.facts) {
      await facts.apply(tx, {
        artworkId: artwork.artworkId,
        run: spec,
        facts: command.facts.facts,
        confirmed: command.facts.confirmed,
        actorSubjectId: input.actorSubjectId,
      });
    }
    if (command.firstBatch) {
      const batch = await stock.apply(tx, {
        artworkId: artwork.artworkId,
        run: spec,
        batch: command.firstBatch,
        actorSubjectId: input.actorSubjectId,
      });
      printCount += batch.quantity;
    }
    await tx.audit.append({
      actorSubjectId: input.actorSubjectId,
      capability: CAPABILITY,
      action: "record_edition_run",
      targetType: "shop_artwork",
      targetId: artwork.artworkId,
      afterJson: {
        run: spec,
        proofsKept: command.proofsKept,
        printCount,
        factsRecorded: command.facts !== null,
        factsConfirmed: command.facts?.confirmed ?? false,
      },
    });
    return printCount;
  }

  return {
    record,

    /**
     * Changes the run of an artwork nothing has been offered from: its prints are planned again.
     * Changing only the proofs kept leaves the prints alone. A changed run needs its facts
     * confirmed again, because what shoppers are told (such as "Limited edition of 40") changed.
     */
    replace(command: ReplaceRunCommand): Promise<{ version: string }> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_run.replace",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const artwork = await tx.prints.lockArtwork(command.artworkId);
            if (!artwork) throw notFound("Artwork not found");
            if (artwork.updatedAt.getTime() !== new Date(command.expectedVersion).getTime()) {
              throw new StaleVersionError("This artwork", artwork.updatedAt.toISOString());
            }
            const current = await tx.runs.getRun(command.artworkId);
            if (!current) throw new ShopDomainError("An original has no run of prints");
            if (current.spec.type === "proof") {
              throw new ShopDomainError("A proof listing keeps the proofs it was created with");
            }
            const next = withMain(
              current.spec,
              mainRunSpec(command.run, artwork.sourceOriginalArtworkId !== null),
            );
            const changed = !sameRun(current.spec, next);
            if (changed) {
              assertRunSizeEditable(await tx.prints.usage(command.artworkId));
              const plan = planEditionRun(next);
              assertValidEditionPlan(plan, next);
              const stored = await tx.facts.get(command.artworkId);
              if (stored) {
                assertEditionFacts(next, { ...stored.facts, confirmed: null });
                await tx.facts.save(command.artworkId, { ...stored.facts, confirmed: null });
              }
              await tx.prints.clearPrints(command.artworkId);
              await tx.runs.saveRun(command.artworkId, {
                spec: next,
                proofsKept: command.proofsKept,
              });
              await tx.prints.createPrints({ ...artwork, plan });
            } else {
              await tx.runs.saveRun(command.artworkId, {
                spec: next,
                proofsKept: command.proofsKept,
              });
            }
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: CAPABILITY,
              action: "replace_edition_run",
              targetType: "shop_artwork",
              targetId: command.artworkId,
              beforeJson: { run: current.spec, proofsKept: current.proofsKept },
              afterJson: { run: next, proofsKept: command.proofsKept },
            });
            return { version: await tx.prints.touch(command.artworkId) };
          },
        }),
      );
    },
  };
}

export type EditionRunService = ReturnType<typeof createEditionRunService>;
