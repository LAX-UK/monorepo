import type { DeliveryRegion, DeliveryRegionEdit, DeliveryRegionId } from "@auction/shop-domain";
import type { ShopAdminAuditWriter } from "../ports/shop-admin-audit.writer.js";
import type { ShopAdminCommandWriter } from "../ports/shop-admin-command.writer.js";

/** The regions and the countries not delivered to, as saved. */
export type DeliveryRegionsState = {
  /** In the order of the domain's region list. */
  regions: DeliveryRegion[];
  /** ISO codes, A to Z. */
  restrictedCountries: string[];
};

export interface DeliveryRegionsReader {
  read(): Promise<DeliveryRegionsState>;
}

/** What a save reads and writes, inside its transaction. */
export interface DeliveryRegionsStore extends DeliveryRegionsReader {
  /** Holds the settings until the transaction ends, so two saves queue up. */
  lock(): Promise<void>;
  saveRegion(input: {
    id: DeliveryRegionId;
    edit: DeliveryRegionEdit;
    actorSubjectId: string;
    at: Date;
  }): Promise<void>;
  replaceRestrictedCountries(codes: readonly string[]): Promise<void>;
}

export type DeliveryRegionsTx = {
  store: DeliveryRegionsStore;
  audit: ShopAdminAuditWriter;
  commands: ShopAdminCommandWriter;
};

export interface DeliveryRegionsUnitOfWork {
  run<T>(fn: (tx: DeliveryRegionsTx) => Promise<T>): Promise<T>;
}
