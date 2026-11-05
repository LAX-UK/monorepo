import {
  FINANCE_ACCESS,
  LOTS_ACCESS,
  LOT_FULFILMENT_ACCESS,
  type StaffRoles,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";

/**
 * Where a person can go from a report to put the problem right. Each link is offered only to the
 * people whose role opens that page, so none of them ends on a "no access" screen.
 */
export type PurchaseProblemLinks = {
  /** The payment panel, where a refund is made. */
  payment: boolean;
  /** The lot record. */
  lot: boolean;
  /** Lot fulfilment, where a delivery is arranged again. */
  fulfilment: boolean;
};

type Holder = { role: UserRole; staffRoles: StaffRoles | undefined };

export function purchaseProblemLinks({ role, staffRoles }: Holder): PurchaseProblemLinks {
  const can = (requirement: Parameters<typeof userHasAccessTo>[2]) =>
    userHasAccessTo(role, staffRoles, requirement);
  return {
    payment: can(FINANCE_ACCESS),
    lot: can(LOTS_ACCESS),
    fulfilment: can(LOT_FULFILMENT_ACCESS),
  };
}
