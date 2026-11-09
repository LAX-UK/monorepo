import type { FramingTx, FramingUnitOfWork } from "../../application/framing/framing.ports.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleFramingStore } from "./drizzle-framing.store.js";

/** Binds the framing catalogue's reads and writes, audit and commands to one transaction. */
export function createDrizzleFramingUnitOfWork(uow: ShopUnitOfWorkFactory): FramingUnitOfWork {
  return {
    run: (fn) =>
      uow.run((effects) => {
        const tx: FramingTx = {
          framing: createDrizzleFramingStore(shopPhaseDbSession(effects)),
          audit: effects.audit,
          commands: effects.commands,
        };
        return fn(tx);
      }),
  };
}
