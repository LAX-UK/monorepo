import type { CreateVenueInput, UpdateVenueInput } from "@auction/types";
import type { CatalogHttpJson } from "./catalog-read-http.js";

export interface ICatalogVenueHttpApplicationService {
  list(input: {
    legalEntityId?: string;
    includeArchived: boolean;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<CatalogHttpJson>;

  get(input: { id: string }): Promise<CatalogHttpJson>;

  create(input: { actorUserId: string; body: CreateVenueInput }): Promise<CatalogHttpJson>;

  update(input: {
    actorUserId: string;
    id: string;
    body: UpdateVenueInput;
  }): Promise<CatalogHttpJson>;

  archive(input: { actorUserId: string; id: string }): Promise<CatalogHttpJson>;
}
