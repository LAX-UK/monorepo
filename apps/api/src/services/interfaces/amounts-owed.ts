import type { AmountOwedEntry, EntityActor } from "@auction/domain";

/** The acting account a read is for: the person's own, or an organisation they belong to. */
export type AmountsOwedAccount = EntityActor & { legalEntityId: string };

/** Every won lot of the account that is owed, held for checks or ended by a cancelled sale. */
export type AmountsOwedView = { entries: AmountOwedEntry[] };

export interface IAmountsOwedService {
  /**
   * What the acting account owes, for the lots the member follows. `null` when the member's role
   * does not follow the account's purchases.
   */
  forAccount(input: {
    userId: string;
    account: AmountsOwedAccount;
  }): Promise<AmountsOwedView | null>;

  /** What a person owes as themselves, for the portfolio reads that have no acting account. */
  forPerson(userId: string): Promise<AmountsOwedView>;
}
