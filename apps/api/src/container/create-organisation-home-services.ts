import type { Database } from "@auction/db";
import {
  DrizzleConsignmentStatusCountsReader,
  DrizzleOpenBidsReader,
  DrizzlePayoutsDueReader,
  DrizzleSoldWorksReader,
  DrizzleUnpaidPurchasesReader,
  DrizzleUpcomingSaleWorksReader,
} from "@auction/persistence/repositories";
import type { IOrganisationDashboardService } from "../services/interfaces/organisation-dashboard-service.js";
import { buyerPurchaseTotal } from "../services/organisation-home/buyer-purchase-total.js";
import { OrganisationDashboardService } from "../services/organisation-home/organisation-dashboard.service.js";

export type OrganisationHomeServices = {
  dashboard: IOrganisationDashboardService;
};

/** The business figures on an organisation's Home, over one read model per figure group. */
export function createOrganisationHomeServices(input: { db: Database }): OrganisationHomeServices {
  return {
    dashboard: new OrganisationDashboardService({
      readers: {
        consignmentStatus: new DrizzleConsignmentStatusCountsReader(input.db),
        upcomingSaleWorks: new DrizzleUpcomingSaleWorksReader(input.db),
        soldWorks: new DrizzleSoldWorksReader(input.db),
        payoutsDue: new DrizzlePayoutsDueReader(input.db),
        openBids: new DrizzleOpenBidsReader(input.db),
        unpaidPurchases: new DrizzleUnpaidPurchasesReader(input.db),
      },
      purchaseTotal: buyerPurchaseTotal,
    }),
  };
}
