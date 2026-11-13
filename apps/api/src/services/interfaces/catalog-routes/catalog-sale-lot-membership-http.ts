import type { Lot, LotStatus, StaffRoles, UserRole } from "@auction/types";
import type { createNestedLotForSaleSchema } from "@auction/validators";
import type { z } from "zod";
import type { UseSalePremiumOutcome } from "../../sale/sale-lot-premium.js";
import type { CatalogRouteOutcome } from "./catalog-route-http.js";

export type PresentedLot = Lot;

export interface ICatalogSaleLotMembershipHttpApplicationService {
  addLot(input: {
    role: UserRole;
    saleId: string;
    body: z.infer<typeof createNestedLotForSaleSchema>;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  attachExistingLot(input: {
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRoles: StaffRoles | undefined;
    via: "attach_endpoint" | "wizard";
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  detachLot(input: {
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<void>>;

  cancelLotOnSale(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRoles: StaffRoles | undefined;
    reason?: string;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  /** Puts unsold lots back on the sale's premium (clears their own rate); audited. */
  useSalePremiumForLots(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    lotIds: readonly string[];
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<UseSalePremiumOutcome>>;

  setLotStatus(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRoles: StaffRoles | undefined;
    status: LotStatus;
    reason?: string;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;
}
