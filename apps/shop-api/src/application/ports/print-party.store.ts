export type PrintParty = { id: string; name: string };

/** The studios and publishers staff pick "Printed by" and "Published by" from. */
export interface PrintPartyStore {
  /** Every name, A to Z. */
  list(): Promise<PrintParty[]>;
  /** Adds a name; "exists" when the same name (ignoring case) is already listed. */
  add(name: string, actorSubjectId: string): Promise<PrintParty | "exists">;
  /** Removes a name; false when it is not listed. Facts already saved keep the name they hold. */
  remove(id: string): Promise<boolean>;
}
