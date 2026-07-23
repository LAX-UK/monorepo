import type { Lot, LotStatus, UserRole } from "@auction/types";
import type { createNestedLotForSaleSchema } from "@auction/validators";
import type { z } from "zod";
import type { CatalogRouteOutcome } from "./catalog-route-http.js";

export type PresentedLot = Lot;

export interface ICatalogSaleLotMembershipHttpApplicationService {
  addLot(input: {
    role: UserRole;
    saleId: string;
    body: z.infer<typeof createNestedLotForSaleSchema>;
    staffRole: string | null;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  attachExistingLot(input: {
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRole: string | null;
    via: "attach_endpoint" | "wizard";
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  detachLot(input: {
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRole: string | null;
  }): Promise<CatalogRouteOutcome<void>>;

  cancelLotOnSale(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRole: string | null;
    reason?: string;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  setLotStatus(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    lotId: string;
    staffRole: string | null;
    status: LotStatus;
    reason?: string;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;
}
