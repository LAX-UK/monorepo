import type { EntityActor } from "@auction/domain";
import type { StaffRoles } from "@auction/types";
import type { ListMyConditionReportRequestsQuery } from "@auction/validators";
import type { UserHttpJson } from "./user-route-http.js";

export interface IUserDashboardHttpApplicationService {
  listConditionReportRequests(input: {
    userId: string;
    query: ListMyConditionReportRequestsQuery;
  }): Promise<UserHttpJson>;

  /** `viewer` decides whether lots carry staff-only figures (reserve); absent means non-staff. */
  listBids(input: {
    userId: string;
    viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined };
  }): Promise<UserHttpJson>;

  listPortfolio(input: {
    userId: string;
    viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined };
  }): Promise<UserHttpJson>;

  /**
   * Bids placed for the acting account, as far as the member's role follows them
   * (`accountBidScope`): everyone's for owners and admins, their own for buyer agents. Each row
   * names the member who placed it; `saleId` narrows to one sale (the per-sale view).
   */
  listAccountBids(input: {
    userId: string;
    account: BuyingAccountActor;
    saleId?: string;
    viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined };
  }): Promise<UserHttpJson>;

  /**
   * Lots won for the acting account with their payment state (`accountPurchaseScope`): every
   * lot for the members who see its money, their own wins for buyer agents.
   */
  listAccountPurchases(input: {
    userId: string;
    account: BuyingAccountActor;
    viewer?: { role?: string | undefined; staffRoles?: StaffRoles | undefined };
  }): Promise<UserHttpJson>;

  /**
   * What the acting account owes, for the lots its purchases list follows: each lot's amount due,
   * its state and what blocks it. The one reading behind the header chip, Purchases, the Needs
   * action counts and the portfolio.
   */
  listAmountsOwed(input: { userId: string; account: BuyingAccountActor }): Promise<UserHttpJson>;
}

/** The acting account and the member's role in it (from the legal-entity context). */
export type BuyingAccountActor = EntityActor & { legalEntityId: string };
