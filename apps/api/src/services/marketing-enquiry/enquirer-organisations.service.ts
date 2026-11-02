import { mayEnquireForOrganisation } from "@auction/domain";
import type { ILegalEntityMembershipReader } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";

/** An organisation the signed-in person may send an enquiry for, and which kinds. */
export type EnquirerOrganisation = {
  id: string;
  name: string;
  role: LegalEntityMemberRole;
  canBuy: boolean;
  canSell: boolean;
};

/** The organisations the enquiry page offers beside "Myself". */
export class EnquirerOrganisationsService {
  constructor(
    private readonly deps: {
      memberships: Pick<ILegalEntityMembershipReader, "listActiveMembershipsForUser">;
    },
  ) {}

  async listFor(userId: string): Promise<EnquirerOrganisation[]> {
    const memberships = await this.deps.memberships.listActiveMembershipsForUser(userId);
    return memberships
      .filter((entity) => entity.kind === "organisation")
      .map((entity) => ({
        id: entity.id,
        name: entity.displayName,
        role: entity.role,
        canBuy: mayEnquireForOrganisation(entity.role, "private_sale_buy"),
        canSell: mayEnquireForOrganisation(entity.role, "private_sale_sell"),
      }))
      .filter((organisation) => organisation.canBuy || organisation.canSell);
  }
}
