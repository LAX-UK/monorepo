import type { AmountOwedEntry, EntityActor } from "@auction/domain";

/** The acting account a read is for: the person's own, or an organisation they belong to. */
export type AmountsOwedAccount = EntityActor & { legalEntityId: string };

/** What one lot still has to send on a part-funded bank transfer, in whole pence. */
export type StillToSendEntry = { lotId: string; groupId: string; pence: number };

/**
 * Every won lot of the account that is owed, held for checks or ended by a cancelled sale, and
 * the lots the person pays that are inside a part-funded bank transfer. A lot is in one list or
 * the other, never both: money still to send is not a payment to start again.
 */
export type AmountsOwedView = { entries: AmountOwedEntry[]; stillToSend: StillToSendEntry[] };

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
