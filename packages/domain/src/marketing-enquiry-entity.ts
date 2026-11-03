import type { LegalEntityMemberRole } from "@auction/types";
import { type EntityCapability, entityRoleCan } from "./entity-capabilities.js";
import type { EnquiryIntent } from "./marketing-enquiry-vocabulary.js";

/** What a member needs to hold to send each kind of enquiry for their organisation. */
const ENTITY_CAPABILITY_BY_INTENT: Partial<Record<EnquiryIntent, EntityCapability>> = {
  private_sale_buy: "entity.private_sale.buy",
  private_sale_sell: "entity.submissions.create",
};

/**
 * Whether a member of an organisation may send this enquiry on its behalf. Enquiries that are not
 * private sales belong to the person who sent them.
 */
export function mayEnquireForOrganisation(
  role: LegalEntityMemberRole,
  intent: EnquiryIntent,
): boolean {
  const capability = ENTITY_CAPABILITY_BY_INTENT[intent];
  return capability !== undefined && entityRoleCan(role, capability);
}
