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
  /** No such record, or one of an account the person is not a member of: the same answer. */
  | { kind: "not_found" }
  /** The record belongs to one of the person's own accounts that they cannot use just now. */
  | { kind: "no_access" };

/**
 * Which of the person's accounts a consignment or purchase belongs to, so a link opened in
 * another account can switch to the right one. To a non-member it reads exactly like a record
 * that does not exist, so someone else's purchase or consignment is never confirmed.
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
    if (!accounts.some((account) => account.id === owner)) return { kind: "not_found" };
    return canUseAccount(owner, accounts, this.ports.organisationsEnabled())
      ? { kind: "ok", legalEntityId: owner }
      : { kind: "no_access" };
  }
}
