import type { Sale, StaffRoles, UserRole } from "@auction/types";
import type { createSaleSchema, updateSaleSchema } from "@auction/validators";
import type { z } from "zod";
import type { SaleBulkSoftDeleteResult } from "../sale-soft-delete.js";
import type {
  CatalogRouteErr,
  CatalogRouteNoContent,
  CatalogRouteOutcome,
} from "./catalog-route-http.js";

export type BulkSoftDeleteSalesOutcome = SaleBulkSoftDeleteResult;

export type PresentedSale = Sale;
export type PresentedSaleWithLots = {
  sale: import("@auction/types").Sale;
  lots: import("@auction/types").Lot[];
};

export interface ICatalogSaleLifecycleHttpApplicationService {
  bulkSoftDelete(input: {
    userId: string;
    role: UserRole;
    ids: string[];
    confirmationPhrase: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<BulkSoftDeleteSalesOutcome>>;

  createSale(input: {
    userId: string;
    role: UserRole;
    staffRoles: StaffRoles | undefined;
    body: z.infer<typeof createSaleSchema>;
  }): Promise<CatalogRouteOutcome<PresentedSale>>;

  updateDraft(input: {
    role: UserRole;
    saleId: string;
    patch: z.infer<typeof updateSaleSchema>;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSale>>;

  publish(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSaleWithLots>>;

  unpublish(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSale>>;

  cancel(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSale>>;

  softDelete(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    confirmationPhrase: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteNoContent | CatalogRouteErr>;

  markOnsiteSaleEnded(input: {
    userId: string;
    role: UserRole;
    saleId: string;
    reason: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedSaleWithLots>>;
}
