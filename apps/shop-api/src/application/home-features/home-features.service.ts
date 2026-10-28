import type { AdminHomeFeatureRow, AdminHomeFeatures } from "@auction/shop-contracts";
import {
  HOME_FEATURES_EDIT_CAPABILITY,
  type HomeFeatureSlot,
  planHomeFeatures,
} from "@auction/shop-domain";
import { HomeFeaturesRejectedError } from "../../errors/home-features-rejected-error.js";
import { withAdminIdempotency } from "../admin/with-admin-idempotency.js";
import type { ArtRefresh } from "../ports/artwork-catalogue-admin.js";
import type { HomeFeatureListReader, HomeFeaturesUnitOfWork } from "./home-features.ports.js";

export type ReplaceHomeFeaturesCommand = {
  slot: HomeFeatureSlot;
  ids: readonly string[];
  actorSubjectId: string;
  idempotencyKey: string;
};

/** lax.art features the same artists, so only that list asks it to refresh. */
const SLOTS_SHOWN_ON_ART: ReadonlySet<HomeFeatureSlot> = new Set(["featured_artists"]);

/**
 * Featured on home: reads the three lists and replaces one at a time. A save is checked by the
 * domain rules (records exist and are of the slot's kind, prints are Shop editions, nothing twice,
 * within the limit), published at once, audited with the list before and after, and replayed for
 * a repeated idempotency key.
 */
export function createHomeFeaturesService(deps: {
  uow: HomeFeaturesUnitOfWork;
  lists: HomeFeatureListReader;
  clock: { now(): Date };
}) {
  return {
    list(): Promise<AdminHomeFeatures> {
      return deps.lists.list();
    },

    searchCandidates<S extends HomeFeatureSlot>(
      slot: S,
      query: { q?: string; limit: number },
    ): Promise<AdminHomeFeatureRow<S>[]> {
      return deps.lists.searchCandidates(slot, query);
    },

    replace(
      command: ReplaceHomeFeaturesCommand,
    ): Promise<{ features: AdminHomeFeatures } & ArtRefresh> {
      return deps.uow.run((tx) =>
        withAdminIdempotency({
          tx,
          commandType: "home_features.replace",
          idempotencyKey: command.idempotencyKey,
          actorSubjectId: command.actorSubjectId,
          requestPayload: { slot: command.slot, ids: command.ids },
          run: async () => {
            await tx.targets.lockSlot(command.slot);
            const before = await tx.targets.slotIds(command.slot);
            const facts = await tx.targets.targetFacts(command.slot, command.ids);
            const plan = planHomeFeatures(
              command.slot,
              command.ids,
              new Map(facts.map((fact) => [fact.id, fact])),
            );
            if (!plan.ok) throw new HomeFeaturesRejectedError(plan.issues);
            await tx.curation.replaceHomePlacements({
              slots: [command.slot],
              placements: plan.placements,
              publishedAt: deps.clock.now(),
            });
            await tx.audit.append({
              actorSubjectId: command.actorSubjectId,
              capability: HOME_FEATURES_EDIT_CAPABILITY,
              action: "home_features.replace",
              targetType: "shop_home_placement",
              targetId: command.slot,
              beforeJson: { ids: before },
              afterJson: { ids: [...command.ids] },
            });
            return {
              features: await tx.lists.list(),
              refreshesArt: SLOTS_SHOWN_ON_ART.has(command.slot),
            };
          },
        }),
      );
    },
  };
}

export type HomeFeaturesService = ReturnType<typeof createHomeFeaturesService>;
