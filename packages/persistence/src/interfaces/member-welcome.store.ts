/** Whether a member has closed the one-time welcome card for an organisation. */
export interface IMemberWelcomeStore {
  /**
   * Records that the person closed the card for their active membership. Returns `false` when
   * they have no active membership in that organisation.
   */
  dismiss(userId: string, legalEntityId: string, at: Date): Promise<boolean>;
}
