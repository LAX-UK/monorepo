import type { Database } from "@auction/db";
import type {
  ShopTransactionEffects,
  ShopUnitOfWorkFactory,
} from "../../application/ports/shop-unit-of-work.js";
import type {
  PickListReader,
  PrintFulfilmentTx,
  PrintFulfilmentUnitOfWork,
} from "../../application/print-fulfilment/print-fulfilment.ports.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import {
  createDrizzleCertificateStore,
  createDrizzleHorsCommerceApprovals,
  createDrizzlePrintEventWriter,
} from "./drizzle-certificate.store.js";
import { createDrizzlePackLineStore, readContexts } from "./drizzle-pack-line.store.js";
import { createDrizzlePrintSwapStore } from "./drizzle-print-swap.store.js";

function bind(effects: ShopTransactionEffects): PrintFulfilmentTx {
  const db = shopPhaseDbSession(effects) as Database;
  return {
    lines: createDrizzlePackLineStore(db),
    swaps: createDrizzlePrintSwapStore(db),
    certificates: createDrizzleCertificateStore(db),
    events: createDrizzlePrintEventWriter(db),
    domainEvents: effects.events,
    horsCommerce: createDrizzleHorsCommerceApprovals(db),
    notifier: {
      printSwapped: (notice) => effects.notifications.queuePrintSwapped(effects.session, notice),
    },
    audit: effects.audit,
    commands: effects.commands,
  };
}

/** Binds every packing port to one shop transaction. */
export function createDrizzlePrintFulfilmentUnitOfWork(
  uow: ShopUnitOfWorkFactory,
): PrintFulfilmentUnitOfWork {
  return { run: (fn) => uow.run((effects) => fn(bind(effects))) };
}

/** The pick list's reads, on the connection pool: no transaction and no locks. */
export function createDrizzlePickListReader(db: Database): PickListReader {
  const lines = createDrizzlePackLineStore(db);
  const certificates = createDrizzleCertificateStore(db);
  return {
    async forOrder(orderId) {
      const orderLines = await lines.forOrder(orderId);
      const [contexts, stored] = await Promise.all([
        readContexts(
          db,
          orderLines.map((line) => line.artworkId),
        ),
        certificates.forEditions(orderLines.map((line) => line.print.editionId)),
      ]);
      return { lines: orderLines, contexts, certificates: stored };
    },
  };
}
