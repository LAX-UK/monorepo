import type { SubscriberZoneLookup } from "@auction/alerts";
import type { IRecipientZoneReader } from "@auction/persistence/interfaces";

/** An account holder's alert times follow the zone saved in LAX Account. */
export class AccountZoneLookup implements SubscriberZoneLookup {
  constructor(private readonly zones: IRecipientZoneReader) {}

  async zoneOf(subjectId: string): Promise<string | null> {
    return (await this.zones.zonesFor([subjectId])).get(subjectId) ?? null;
  }
}
