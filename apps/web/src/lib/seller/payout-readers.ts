import { oneOfRoles } from "@/lib/presenters/organisation-state/organisation-state-copy";
import { rolesWithCapability } from "@auction/domain";

/**
 * "an owner, admin or finance member": who sees an organisation's payouts, from the capability
 * matrix, for the line that says why a statement or payout step is not shown.
 */
export const PAYOUT_READERS = oneOfRoles(rolesWithCapability("entity.payouts.read"), "inside");
