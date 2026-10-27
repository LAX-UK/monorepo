import { canUseAccount } from "@auction/domain";
import type {
  AccountRecordKind,
  ILegalEntityRepository,
  IRecordAccountReader,
} from "@auction/persistence/interfaces";

export type RecordAccountPorts = {
  accounts: Pick<ILegalEntityRepository, "listActiveMembershipsForUser">;
  records: IRecordAccountReader;
  organisationsEnabled: () => boolean;
};

export type RecordAccountOutcome =
  | { kind: "ok"; legalEntityId: string }
  | { kind: "not_found" }
  /** The record exists but belongs to an account the person cannot use. */
  | { kind: "no_access" };

/**
 * Which of the person's accounts a consignment or purchase belongs to, so a link opened in
 * another account can switch to the right one. It never reveals the owner to a non-member.
 */
export class RecordAccountService {
  constructor(private readonly ports: RecordAccountPorts) {}

  async accountFor(
    userId: string,
    kind: AccountRecordKind,
    recordId: string,
  ): Promise<RecordAccountOutcome> {
    const owner = await this.ports.records.findOwningAccount(kind, recordId);
    if (!owner) return { kind: "not_found" };
    const accounts = await this.ports.accounts.listActiveMembershipsForUser(userId);
    return canUseAccount(owner, accounts, this.ports.organisationsEnabled())
      ? { kind: "ok", legalEntityId: owner }
      : { kind: "no_access" };
  }
}
