import type {
  EditionFramingTx,
  EditionFramingUnitOfWork,
} from "../../application/framing/edition-framing.ports.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleEditionFramingStore } from "./drizzle-edition-framing.store.js";

/** Binds an edition's framing reads and writes, audit and commands to one transaction. */
export function createDrizzleEditionFramingUnitOfWork(
  uow: ShopUnitOfWorkFactory,
): EditionFramingUnitOfWork {
  return {
    run: (fn) =>
      uow.run((effects) => {
        const tx: EditionFramingTx = {
          framing: createDrizzleEditionFramingStore(shopPhaseDbSession(effects)),
          audit: effects.audit,
          commands: effects.commands,
        };
        return fn(tx);
      }),
  };
}
