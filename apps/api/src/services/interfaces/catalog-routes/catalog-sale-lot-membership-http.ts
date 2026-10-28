import type { Lot, LotStatus, StaffRoles, UserRole } from "@auction/types";
import type { createNestedLotForSaleSchema } from "@auction/validators";
import type { z } from "zod";
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
