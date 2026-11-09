import type { PartyDealRecord } from "@auction/domain";

/** The private sale deals a person or an organisation is, or was ever named as, a party to. */
export interface IPartyDealRecordReader {
  forUser(userId: string): Promise<PartyDealRecord[]>;
  forLegalEntity(legalEntityId: string): Promise<PartyDealRecord[]>;
}
