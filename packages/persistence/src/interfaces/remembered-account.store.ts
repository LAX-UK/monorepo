/** The account a person last used Bid as, kept on their Bid profile so every device opens in it. */
export interface IRememberedAccountStore {
  /** The remembered legal entity id, or `null` when none is stored. */
  findRemembered(userId: string): Promise<string | null>;
  remember(userId: string, legalEntityId: string): Promise<void>;
}
