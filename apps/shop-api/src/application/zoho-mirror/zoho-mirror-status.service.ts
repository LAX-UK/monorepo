import type { AdminZohoMirrorStatus, ZohoMirrorEntity } from "@auction/shop-contracts";
import type { ZohoMirrorLedgerReader } from "../ports/zoho-mirror.ports.js";
import { deriveZohoMirrorState } from "./derive-zoho-mirror-state.js";

/**
 * Whether a record reached Zoho, for the "Mirrored to Zoho" badge. Reads the delivery ledger and
 * works the state out each time; nothing here changes the ledger or stores a second copy.
 */
export class ZohoMirrorStatusService {
  constructor(private readonly ledger: ZohoMirrorLedgerReader) {}

  async statuses(
    entity: ZohoMirrorEntity,
    ids: readonly string[],
  ): Promise<AdminZohoMirrorStatus[]> {
    const unique = [...new Set(ids)];
    const { consumer, deliveries } = await this.ledger.read(entity, unique);
    return unique.map((id) => ({
      entity,
      id,
      consumer,
      ...deriveZohoMirrorState(entity, deliveries.get(id) ?? []),
    }));
  }

  async status(entity: ZohoMirrorEntity, id: string): Promise<AdminZohoMirrorStatus> {
    const [status] = await this.statuses(entity, [id]);
    return status as AdminZohoMirrorStatus;
  }
}
