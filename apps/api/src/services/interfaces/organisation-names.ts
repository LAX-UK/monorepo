/** An organisation's name, for the words of its notices and emails. */
export interface IOrganisationNames {
  nameOf(legalEntityId: string): Promise<string | null>;
}
