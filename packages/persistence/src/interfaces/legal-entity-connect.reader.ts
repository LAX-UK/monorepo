import type {
  ConnectAccountCreationContextRow,
  LegalEntityConnectRow,
} from "../lib/legal-entity-connect.types.js";

export interface ILegalEntityConnectReader {
  findLegalEntityRowById(id: string): Promise<LegalEntityConnectRow | null>;

  findLegalEntityRowByStripeAccountId(
    stripeAccountId: string,
  ): Promise<LegalEntityConnectRow | null>;

  loadAccountCreationContext(
    legalEntityId: string,
  ): Promise<ConnectAccountCreationContextRow | null>;
}
