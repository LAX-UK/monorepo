/** Records that belong to one account and can be linked to from outside Bid (emails, alerts). */
export type AccountRecordKind = "consignment" | "purchase";

/** Which legal entity owns a record, whatever account the person is using right now. */
export interface IRecordAccountReader {
  /** The owning legal entity id, or `null` when the record does not exist or has no owner. */
  findOwningAccount(kind: AccountRecordKind, id: string): Promise<string | null>;
}
