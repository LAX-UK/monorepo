import type {
  HomeCoverTx,
  HomeCoverUnitOfWork,
} from "../../application/home-cover/home-cover.ports.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleHomeCoverStore } from "./drizzle-home-cover.store.js";

/** Binds the cover's reads and writes, audit and commands to one transaction. */
export function createDrizzleHomeCoverUnitOfWork(uow: ShopUnitOfWorkFactory): HomeCoverUnitOfWork {
  return {
    run: (fn) =>
      uow.run((effects) => {
        const tx: HomeCoverTx = {
          store: createDrizzleHomeCoverStore(shopPhaseDbSession(effects)),
          audit: effects.audit,
          commands: effects.commands,
        };
        return fn(tx);
      }),
  };
}
