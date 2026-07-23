import type { UserRole, UserStaffRole } from "@auction/types";
import type {
  CreateArtistInput,
  MergeArtistRouteInput,
  ProposeMatchesInput,
  ReviewArtistInput,
} from "../../interfaces/artist-registry.js";
import type { CatalogHttpJson } from "./catalog-read-http.js";
import type { CatalogRouteOutcome } from "./catalog-route-http.js";

export type CatalogArtistBrowseInput = {
  limit: number;
  offset: number;
  q?: string;
  kind?: string;
  kinds?: string[];
  letter?: string;
  living?: boolean;
  historical?: boolean;
  nationality?: string;
  country?: string;
  categorySlug?: string;
  featuredOnly?: boolean;
  featuredFirst?: boolean;
  decade?: string;
  hasUpcoming?: boolean;
  sort: "name_asc" | "popular" | "recent";
};

export interface ICatalogArtistHttpApplicationService {
  search(input: {
    q: string;
    limit: number;
    role: UserRole;
    staffRole: UserStaffRole | null;
  }): Promise<CatalogHttpJson>;

  listPublic(input: { limit: number; offset: number }): Promise<CatalogHttpJson>;

  browsePublic(input: CatalogArtistBrowseInput): Promise<CatalogHttpJson>;

  checkNameAvailability(input: { displayName: string }): Promise<CatalogHttpJson>;

  proposeMatchesForAdmin(input: {
    userId: string;
    body: ProposeMatchesInput;
  }): Promise<CatalogHttpJson>;

  getAliasesPublic(input: { id: string }): Promise<CatalogHttpJson>;

  getBySlug(input: {
    slug: string;
    role: UserRole;
    staffRole: UserStaffRole | null;
  }): Promise<CatalogHttpJson>;

  getById(input: {
    id: string;
    role: UserRole;
    staffRole: UserStaffRole | null;
  }): Promise<CatalogHttpJson>;

  create(input: { userId: string; body: CreateArtistInput }): Promise<CatalogHttpJson>;

  addAlias(input: {
    userId: string;
    id: string;
    alias: string;
    kind?: string;
  }): Promise<CatalogHttpJson>;

  mergeWithConfirmation(input: {
    userId: string;
    fromArtistId: string;
    body: MergeArtistRouteInput;
  }): Promise<CatalogHttpJson>;

  review(input: {
    userId: string;
    id: string;
    body: ReviewArtistInput;
  }): Promise<CatalogHttpJson>;

  getDeleteEligibility(input: { id: string }): Promise<CatalogHttpJson>;

  delete(input: {
    userId: string;
    role: UserRole;
    staffRole: string | null;
    id: string;
    confirmationPhrase: string;
  }): Promise<CatalogRouteOutcome<void>>;
}
