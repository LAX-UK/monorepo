import type {
  AccountDirectory,
  AccountsLookup,
  ViewedAccount,
} from "@/lib/legal-entity/account-directory";
import type { LegalEntitySummary } from "@auction/types";

/** An in-memory {@link AccountDirectory} for tests: set the answer, read back what was asked. */
export class FakeAccountDirectory implements AccountDirectory {
  readonly listCalls: { mustInclude?: string | null }[] = [];
  private answer: AccountsLookup;
  private viewed: ViewedAccount | null = null;

  constructor(accounts: readonly LegalEntitySummary[] = []) {
    this.answer = { ok: true, accounts };
  }

  /** Every later `listMine` fails with `reason`. */
  failWith(reason: Extract<AccountsLookup, { ok: false }>["reason"]): this {
    this.answer = { ok: false, reason };
    return this;
  }

  /** The account a staff view-as session shows. */
  viewing(viewed: ViewedAccount | null): this {
    this.viewed = viewed;
    return this;
  }

  async listMine(options: { mustInclude?: string | null } = {}): Promise<AccountsLookup> {
    this.listCalls.push(options);
    return this.answer;
  }

  async findViewedAccount(accountId: string): Promise<ViewedAccount | null> {
    return this.viewed?.account.id === accountId ? this.viewed : null;
  }
}

export const PERSONAL_ACCOUNT: LegalEntitySummary = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Lena Fischer",
  kind: "individual",
  subkind: "private_collector",
  status: "approved",
  role: "owner",
  isPrimaryAdmin: true,
};

export const ORGANISATION_ACCOUNT: LegalEntitySummary = {
  id: "22222222-2222-4222-8222-222222222222",
  displayName: "Northbank Gallery",
  kind: "organisation",
  subkind: "gallery",
  status: "approved",
  role: "admin",
  isPrimaryAdmin: false,
};
