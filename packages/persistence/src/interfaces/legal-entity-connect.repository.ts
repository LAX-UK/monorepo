import type { Database } from "@auction/db";
import type {
  ApplyConnectStatusTransitionInput,
  LegalEntityConnectRow,
  PersistConnectAccountInput,
  StripeConnectFlagPatch,
} from "../lib/legal-entity-connect.types.js";
import type { ILegalEntityConnectReader } from "./legal-entity-connect.reader.js";

export interface ILegalEntityConnectRepository extends ILegalEntityConnectReader {
  forConnection(conn: Database): ILegalEntityConnectRepository;

  persistConnectAccount(input: PersistConnectAccountInput): Promise<LegalEntityConnectRow | null>;

  updateStripeConnectFlags(
    legalEntityId: string,
    flags: StripeConnectFlagPatch,
    db?: Database,
  ): Promise<void>;

  applyConnectStatusTransition(
    input: ApplyConnectStatusTransitionInput,
    db?: Database,
  ): Promise<LegalEntityConnectRow | null>;

  applyDeauthorized(stripeAccountId: string, db?: Database): Promise<LegalEntityConnectRow | null>;
}
