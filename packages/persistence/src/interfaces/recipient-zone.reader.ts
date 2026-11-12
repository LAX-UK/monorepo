/**
 * Where a person's LAX Account says they are: the zone their emails show times in as well as the
 * official one. It is the Account preference as the products copy it (a fixed city, or the zone
 * the person's device last reported); `null` when Account has none, UTC and `Etc/*` never being
 * stored.
 */
export interface IRecipientZoneReader {
  /** The saved zone of each person who has one; people without one are absent from the map. */
  zonesFor(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
