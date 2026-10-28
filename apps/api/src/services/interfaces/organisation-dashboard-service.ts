import type { DashboardFigures } from "@auction/domain";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

/**
 * The business figures on an organisation's Home, for the signed-in member. Only the figure groups
 * the member's role uses are read, each narrowed to what the role may see; all of them in one
 * request. A buyer agent's authorisations are not among them: Home already reads those for its
 * tasks and reuses them.
 */
export interface IOrganisationDashboardService {
  figures(actor: OrganisationMemberActor): Promise<DashboardFigures>;
}
