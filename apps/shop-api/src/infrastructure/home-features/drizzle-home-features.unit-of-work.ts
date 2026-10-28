import type {
  HomeFeaturesTx,
  HomeFeaturesUnitOfWork,
} from "../../application/home-features/home-features.ports.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleStorefrontCurationWriter } from "../drizzle-storefront-curation.repository.js";
import {
  createDrizzleHomeFeatureListReader,
  createDrizzleHomeFeatureTargetReader,
} from "./drizzle-home-feature.reader.js";

/** Binds the featured lists' reads, the curation writer, audit and commands to one transaction. */
export function createDrizzleHomeFeaturesUnitOfWork(
  uow: ShopUnitOfWorkFactory,
  options: { resolveMediaUrl: (value: string | null | undefined) => string | null },
): HomeFeaturesUnitOfWork {
  return {
    run: (fn) =>
      uow.run((effects) => {
        const db = shopPhaseDbSession(effects);
        const tx: HomeFeaturesTx = {
          targets: createDrizzleHomeFeatureTargetReader(db),
          lists: createDrizzleHomeFeatureListReader(db, options),
          curation: createDrizzleStorefrontCurationWriter(db),
          audit: effects.audit,
          commands: effects.commands,
        };
        return fn(tx);
      }),
  };
}
