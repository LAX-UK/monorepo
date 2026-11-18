import type { Consignor, ConsignorAgreement } from "@auction/artwork-register-contracts";
import type { ConsignorParty } from "./consignor-agreement.ports.js";

/** What a move reads about the work's consignor and their agreements. */
export type MoveAgreementReads = {
  /** Who consigned the work now; null when no one has said. */
  currentConsignor(registerId: string): Promise<Consignor | null>;
  /** The client's agreements, current and retired (replaced versions left out). */
  listAgreements(partyId: string): Promise<ConsignorAgreement[]>;
  /** The client's name; null when there is no such client. */
  consignorParty(partyId: string): Promise<ConsignorParty | null>;
};
