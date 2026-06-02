import type { CreateVenueInput, UpdateVenueInput, Venue } from "@auction/types";
import type { ServiceResult } from "../http/service-result";

export type AdminVenueListRow = Venue & {
  legalEntityDisplayName: string | null;
};

export type AdminVenueListResult = {
  venues: AdminVenueListRow[];
  total: number;
};

export type VenueDetail = {
  venue: Venue;
  salesUsingCount: number;
  /** Resolved by the web layer (not from API directly). */
  legalEntityDisplayName?: string | null;
};

export interface IAdminVenueService {
  list(input?: {
    legalEntityId?: string;
    includeArchived?: boolean;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<ServiceResult<AdminVenueListResult>>;
  get(id: string): Promise<ServiceResult<Venue>>;
  getDetail(id: string): Promise<ServiceResult<VenueDetail>>;
  create(input: CreateVenueInput): Promise<ServiceResult<Venue>>;
  update(id: string, input: UpdateVenueInput): Promise<ServiceResult<Venue>>;
  archive(id: string): Promise<ServiceResult<Venue>>;
}
