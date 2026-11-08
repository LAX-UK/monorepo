import type {
  DeliveryRegionsTx,
  DeliveryRegionsUnitOfWork,
} from "../../application/delivery-regions/delivery-regions.ports.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleDeliveryRegionsStore } from "./drizzle-delivery-regions.store.js";

/** Binds the delivery settings' reads and writes, audit and commands to one transaction. */
export function createDrizzleDeliveryRegionsUnitOfWork(
  uow: ShopUnitOfWorkFactory,
): DeliveryRegionsUnitOfWork {
  return {
    run: (fn) =>
      uow.run((effects) => {
        const tx: DeliveryRegionsTx = {
          store: createDrizzleDeliveryRegionsStore(shopPhaseDbSession(effects)),
          audit: effects.audit,
          commands: effects.commands,
        };
        return fn(tx);
      }),
  };
}
