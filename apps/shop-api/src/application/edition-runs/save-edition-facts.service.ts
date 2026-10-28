import type { AdminEditionFactsBulkResponse } from "@auction/shop-contracts";
import {
  type EditionFacts,
  type EditionRunSpec,
  ShopDomainError,
  assertCorrectionReason,
  assertEditionFacts,
  assertFactsEditable,
  runLocks,
} from "@auction/shop-domain";
import { notFound } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type { StoredEditionRun } from "../ports/edition-run.repository.js";
import type {
  Clock,
  EditionRunTx,
  EditionRunUnitOfWork,
  RunArtwork,
  StaffCommand,
} from "./edition-run.ports.js";

const CAPABILITY = "catalogue.write";
const CORRECT_CAPABILITY = "edition_facts.correct";
const AUDIT_TARGET = "shop_artwork";

type FactsInput = Omit<EditionFacts, "confirmed">;

export type ApplyFactsInput = {
  artworkId: string;
  run: EditionRunSpec;
  facts: FactsInput;
  confirmed: boolean;
  actorSubjectId: string;
};

export type SaveFactsCommand = StaffCommand & {
  artworkId: string;
  facts: FactsInput;
  confirmed: boolean;
  /** The facts version the editor opened; null when the run had none. */
  expectedFactsVersion: string | null;
};

export type CorrectFactsCommand = StaffCommand & {
  artworkId: string;
  facts: FactsInput;
  reason: string;
  expectedFactsVersion: string | null;
};

export type BulkFactsCommand = StaffCommand & {
  artworkIds: readonly string[];
  facts: FactsInput;
  confirmed: boolean;
};

function plain(facts: EditionFacts | null) {
  if (!facts) return null;
  return {
    numbering: facts.numbering,
    signature: facts.signature,
    certificate: facts.certificate,
    confirmed: facts.confirmed
      ? { by: facts.confirmed.by, at: facts.confirmed.at.toISOString() }
      : null,
  };
}

/**
 * Saving what is true of a run: numbering, signature and certificate. The domain checks the facts
 * against each other and the run; facts lock at the first paid order (rule 13), after which only
 * a shop admin can correct them, with a reason, and the orders already paid keep how they were
 * described. Confirming records who checked the facts and when; publishing waits for it.
 */
export function createSaveEditionFactsService(deps: { uow: EditionRunUnitOfWork; clock: Clock }) {
  const { uow, clock } = deps;

  /** Checks and stores facts on a run already locked in `tx`. Returns the new facts version. */
  async function apply(tx: EditionRunTx, input: ApplyFactsInput): Promise<string> {
    const facts: EditionFacts = {
      ...input.facts,
      confirmed: input.confirmed ? { by: input.actorSubjectId, at: clock.now() } : null,
    };
    assertEditionFacts(input.run, facts);
    return tx.facts.save(input.artworkId, facts);
  }

  async function loadRun(
    tx: EditionRunTx,
    artworkId: string,
  ): Promise<{ artwork: RunArtwork; run: StoredEditionRun }> {
    const artwork = await tx.prints.lockArtwork(artworkId);
    if (!artwork) throw notFound("Artwork not found");
    const run = await tx.runs.getRun(artworkId);
    if (!run) throw new ShopDomainError("An original has no edition facts");
    return { artwork, run };
  }

  async function assertVersion(tx: EditionRunTx, artworkId: string, expected: string | null) {
    const current = await tx.facts.get(artworkId);
    const currentVersion = current?.version ?? null;
    const same =
      currentVersion === expected ||
      (currentVersion !== null &&
        expected !== null &&
        new Date(currentVersion).getTime() === new Date(expected).getTime());
    if (!same) throw new StaleVersionError("These edition facts", currentVersion ?? "none");
    return current;
  }

  return {
    apply,

    save(command: SaveFactsCommand): Promise<{ factsVersion: string; confirmed: boolean }> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_facts.save",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const { run } = await loadRun(tx, command.artworkId);
            assertFactsEditable(await tx.prints.usage(command.artworkId));
            const before = await assertVersion(tx, command.artworkId, command.expectedFactsVersion);
            const factsVersion = await apply(tx, {
              artworkId: command.artworkId,
              run: run.spec,
              facts: command.facts,
              confirmed: command.confirmed,
              actorSubjectId: command.actorSubjectId,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: CAPABILITY,
              action: "save_edition_facts",
              targetType: AUDIT_TARGET,
              targetId: command.artworkId,
              beforeJson: { facts: plain(before?.facts ?? null) },
              afterJson: { facts: { ...command.facts, confirmed: command.confirmed } },
            });
            return { factsVersion, confirmed: command.confirmed };
          },
        }),
      );
    },

    /**
     * After a sale: replaces the facts, keeps the old description on every paid order that has
     * no record yet, and audits the reason with the orders it affected. The person correcting
     * confirms the new facts.
     */
    correct(
      command: CorrectFactsCommand,
    ): Promise<{ factsVersion: string; confirmed: boolean; affectedOrders: number }> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_facts.correct",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const reason = assertCorrectionReason(command.reason);
            const { run } = await loadRun(tx, command.artworkId);
            const before = await assertVersion(tx, command.artworkId, command.expectedFactsVersion);
            const orders = await tx.facts.paidOrders(command.artworkId);
            if (before) {
              await tx.facts.keepOrderSnapshots(command.artworkId, {
                schemaVersion: 1,
                run: run.spec,
                proofsKept: run.proofsKept,
                facts: plain(before.facts),
              });
            }
            const factsVersion = await apply(tx, {
              artworkId: command.artworkId,
              run: run.spec,
              facts: command.facts,
              confirmed: true,
              actorSubjectId: command.actorSubjectId,
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: CORRECT_CAPABILITY,
              action: "correct_edition_facts",
              targetType: AUDIT_TARGET,
              targetId: command.artworkId,
              beforeJson: { facts: plain(before?.facts ?? null) },
              afterJson: {
                facts: command.facts,
                reason,
                affectedOrders: orders.map((order) => order.reference),
              },
            });
            return { factsVersion, confirmed: true, affectedOrders: orders.length };
          },
        }),
      );
    },

    /**
     * The same facts on several runs. A run with paid orders is skipped (its sold prints were
     * described as they were), and a run the facts do not fit is refused; neither stops the rest.
     */
    setForRuns(command: BulkFactsCommand): Promise<AdminEditionFactsBulkResponse> {
      return uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "edition_facts.bulk_set",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: command,
          run: async () => {
            const results: AdminEditionFactsBulkResponse["results"] = [];
            // Lock in id order so two overlapping bulk changes cannot deadlock.
            for (const artworkId of [...new Set(command.artworkIds)].sort()) {
              const artwork = await tx.prints.lockArtwork(artworkId);
              const run = artwork ? await tx.runs.getRun(artworkId) : null;
              if (!artwork || !run) {
                results.push({ artworkId, outcome: "not_found" });
                continue;
              }
              if (runLocks(await tx.prints.usage(artworkId)).factsLocked) {
                results.push({
                  artworkId,
                  outcome: "skipped",
                  message: "Sold prints were described this way",
                });
                continue;
              }
              try {
                assertEditionFacts(run.spec, { ...command.facts, confirmed: null });
              } catch (error) {
                if (!(error instanceof ShopDomainError)) throw error;
                results.push({ artworkId, outcome: "refused", message: error.message });
                continue;
              }
              const before = await tx.facts.get(artworkId);
              await apply(tx, {
                artworkId,
                run: run.spec,
                facts: command.facts,
                confirmed: command.confirmed,
                actorSubjectId: command.actorSubjectId,
              });
              await tx.audit.append({
                actorSubjectId: command.actorSubjectId,
                capability: CAPABILITY,
                action: "save_edition_facts",
                targetType: AUDIT_TARGET,
                targetId: artworkId,
                beforeJson: { facts: plain(before?.facts ?? null) },
                afterJson: {
                  facts: { ...command.facts, confirmed: command.confirmed },
                  bulk: true,
                },
              });
              results.push({ artworkId, outcome: "changed" });
            }
            const order = new Map(command.artworkIds.map((id, index) => [id, index]));
            results.sort((a, b) => (order.get(a.artworkId) ?? 0) - (order.get(b.artworkId) ?? 0));
            return { results };
          },
        }),
      );
    },
  };
}

export type SaveEditionFactsService = ReturnType<typeof createSaveEditionFactsService>;
