import type { CreateLotInput, StaffRoles, UserRole } from "@auction/types";
import type { LotBulkSoftDeleteResult } from "../lot-soft-delete.js";
import type {
  CatalogRouteErr,
  CatalogRouteNoContent,
  CatalogRouteOutcome,
} from "./catalog-route-http.js";
import type { PresentedLot } from "./catalog-sale-lot-membership-http.js";

export type BulkLotsOutcome =
  | LotBulkSoftDeleteResult
  | {
      attempted: number;
      failed: number;
      errors: Array<{ lotId: string; message: string; code?: string }>;
    };

export interface ICatalogLotLifecycleHttpApplicationService {
  bulkLots(input: {
    userId: string;
    role: UserRole;
    staffRoles: StaffRoles | undefined;
    ids: string[];
    op: "soft_delete" | "publish" | "cancel";
    confirmationPhrase?: string;
    reason?: string;
  }): Promise<CatalogRouteOutcome<BulkLotsOutcome>>;

  publish(input: {
    userId: string;
    role: UserRole;
    lotId: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  requestWithdrawal(input: {
    sellerUserId: string;
    lotId: string;
  }): Promise<CatalogRouteOutcome<{ alreadyPending: boolean } & Record<string, unknown>>>;

  cancel(input: {
    userId: string;
    role: UserRole;
    lotId: string;
    staffRoles: StaffRoles | undefined;
    cancelReason: "admin_override" | "manual";
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  softDelete(input: {
    userId: string;
    role: UserRole;
    lotId: string;
    confirmationPhrase: string;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteNoContent | CatalogRouteErr>;

  update(input: {
    role: UserRole;
    lotId: string;
    body: Partial<CreateLotInput>;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  updateMarketingDetails(input: {
    role: UserRole;
    lotId: string;
    body: Record<string, unknown>;
    staffRoles: StaffRoles | undefined;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;

  create(input: {
    userId: string;
    role: UserRole;
    staffRoles: StaffRoles | undefined;
    body: CreateLotInput;
  }): Promise<CatalogRouteOutcome<PresentedLot>>;
}
