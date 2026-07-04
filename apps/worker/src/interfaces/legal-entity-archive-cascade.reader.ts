import type { EntityRecipient } from "./notification-fanout.reader.js";

export interface ILegalEntityArchiveCascadeReader {
  getEntityDisplayName(legalEntityId: string): Promise<string>;
  listNotifyMembers(legalEntityId: string): Promise<EntityRecipient[]>;
}
