import type { CreateVenueInput, UpdateVenueInput, Venue } from "@auction/types";

export type ListVenuesFilter = {
  legalEntityId?: string | undefined;
  includeArchived?: boolean | undefined;
  q?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export type VenueListRow = Venue & {
  legalEntityDisplayName: string | null;
};

export interface IVenueRepository {
  findById(id: string): Promise<Venue | null>;
  findBySlug(legalEntityId: string, slug: string): Promise<Venue | null>;
  list(filter?: ListVenuesFilter): Promise<VenueListRow[]>;
  count(filter?: ListVenuesFilter): Promise<number>;
  create(input: CreateVenueInput & { slug: string }): Promise<Venue>;
  update(
    id: string,
    input: UpdateVenueInput & { slug?: string | undefined },
  ): Promise<Venue | null>;
  archive(id: string): Promise<Venue | null>;
  countSalesUsing(venueId: string): Promise<number>;
}
