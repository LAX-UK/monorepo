import type { AdminZohoMirrorStatus, ZohoMirrorEntity } from "@auction/shop-contracts";
import type { ZohoMirrorMode } from "@auction/types";
import type {
  MirrorDelivery,
  OrderPaymentStateReader,
  ZohoMirrorLedgerReader,
} from "../ports/zoho-mirror.ports.js";
import { deriveZohoMirrorState } from "./derive-zoho-mirror-state.js";

export type ZohoMirrorStatusDeps = {
  ledger: ZohoMirrorLedgerReader;
  orders: OrderPaymentStateReader;
  /** The worker's mirror modes, as shop-api is configured with them; null when it is not told. */
  modes: Record<ZohoMirrorEntity, ZohoMirrorMode | null>;
  /**
   * The worker's LAX listing mode (`ZOHO_ARTWORK_LISTING_MODE`), for an artwork's listing
   * deliveries; null or absent when it is not told.
   */
  artworkListingMode?: ZohoMirrorMode | null;
};

/**
 * Whether a record reached Zoho, for the "Mirrored to Zoho" badge. Reads the delivery ledger and
 * works the state out each time; nothing here changes the ledger or stores a second copy.
 */
export class ZohoMirrorStatusService {
  constructor(private readonly deps: ZohoMirrorStatusDeps) {}

  async statuses(
    entity: ZohoMirrorEntity,
    ids: readonly string[],
  ): Promise<AdminZohoMirrorStatus[]> {
    const unique = [...new Set(ids)];
    const { consumer, deliveries } = await this.deps.ledger.read(entity, unique);
    const mode = this.deps.modes[entity];
    const paid = await this.paidOfUnsent(entity, mode, unique, deliveries);
    return unique.map((id) => ({
      entity,
      id,
      consumer,
      ...deriveZohoMirrorState(entity, deliveries.get(id) ?? [], {
        mode,
        listingMode: entity === "artwork" ? (this.deps.artworkListingMode ?? null) : null,
        paid: paid.get(id) ?? null,
      }),
    }));
  }

  async status(entity: ZohoMirrorEntity, id: string): Promise<AdminZohoMirrorStatus> {
    const [status] = await this.statuses(entity, [id]);
    return status as AdminZohoMirrorStatus;
  }

  /**
   * An unpaid order raises no event the order mirror hears, so its ledger is empty; whether it is
   * paid tells "only paid orders are sent" from "nothing sent yet". Asked once for the batch, and
   * only for orders with no delivery while the mirror may be on.
   */
  private async paidOfUnsent(
    entity: ZohoMirrorEntity,
    mode: ZohoMirrorMode | null,
    ids: readonly string[],
    deliveries: Map<string, MirrorDelivery[]>,
  ): Promise<Map<string, boolean>> {
    if (entity !== "order" || mode === "off") return new Map();
    const unsent = ids.filter((id) => (deliveries.get(id) ?? []).length === 0);
    return unsent.length > 0 ? this.deps.orders.paidOf(unsent) : new Map();
  }
}
