/** How buyers and LAX reach an organisation. Each is `null` until it is given. */
export type ContactDetails = {
  email: string | null;
  phone: string | null;
  website: string | null;
  updatedAt: Date | null;
};

export interface IContactDetailsRepository {
  /** The organisation's contact details, or `null` when none were ever saved. */
  find(legalEntityId: string): Promise<ContactDetails | null>;
  /** Replaces the whole set and returns the saved details. */
  save(
    legalEntityId: string,
    details: Omit<ContactDetails, "updatedAt">,
    updatedByUserId: string,
  ): Promise<ContactDetails>;
}
