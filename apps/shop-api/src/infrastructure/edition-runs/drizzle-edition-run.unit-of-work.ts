import type { Database } from "@auction/db";
import type {
  EditionRunTx,
  EditionRunUnitOfWork,
} from "../../application/edition-runs/edition-run.ports.js";
import type {
  ShopTransactionEffects,
  ShopUnitOfWorkFactory,
} from "../../application/ports/shop-unit-of-work.js";
import { createDrizzleEditionRunRepository } from "../drizzle-edition-run.repository.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleEditionFactsStore } from "./drizzle-edition-facts.store.js";
import { createDrizzleEditionPrintStore } from "./drizzle-edition-print.store.js";
import { createDrizzleLinkedListingWriter } from "./drizzle-linked-listing.writer.js";

function bind(effects: ShopTransactionEffects): EditionRunTx {
  const db = shopPhaseDbSession(effects) as Database;
  return {
    runs: createDrizzleEditionRunRepository(db),
    prints: createDrizzleEditionPrintStore(db),
    facts: createDrizzleEditionFactsStore(db),
    listings: createDrizzleLinkedListingWriter(db, effects.events),
    audit: effects.audit,
    commands: effects.commands,
  };
}

/** Binds every edition run port to one shop transaction. */
export function createDrizzleEditionRunUnitOfWork(
  uow: ShopUnitOfWorkFactory,
): EditionRunUnitOfWork {
  return {
    run: (fn) => uow.run((effects) => fn(bind(effects))),
    bind,
  };
}
