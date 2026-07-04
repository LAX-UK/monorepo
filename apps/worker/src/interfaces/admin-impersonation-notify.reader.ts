import type { EntityRecipient } from "./notification-fanout.reader.js";

export interface IAdminImpersonationNotifyReader {
  getAdminDisplayName(userId: string): Promise<string>;
  listEntityOwnerAdmins(legalEntityId: string): Promise<EntityRecipient[]>;
}
