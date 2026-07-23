import { type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import type { ArtistKind } from "@auction/types";
import { ArtistError } from "../../lib/errors.js";
import type { ArtistDeleteService } from "../artist-delete.service.js";
import type { ArtistProfileService } from "../artist-profile.service.js";
import type {
  CreateArtistInput,
  IArtistRegistryService,
  MergeArtistRouteInput,
  ProposeMatchesInput,
  ReviewArtistInput,
} from "../interfaces/artist-registry.js";
import type {
  CatalogArtistBrowseInput,
  ICatalogArtistHttpApplicationService,
} from "../interfaces/catalog-routes/catalog-artist-http.js";
import type { CatalogHttpJson } from "../interfaces/catalog-routes/catalog-read-http.js";
import type { CatalogRouteOutcome } from "../interfaces/catalog-routes/catalog-route-http.js";

function notFoundJson(): CatalogHttpJson {
  return { status: 404, body: { error: "Not found" } };
}

function okData<T>(data: T, status = 200): CatalogHttpJson {
  return { status, body: { data } };
}

export class CatalogArtistHttpApplicationService implements ICatalogArtistHttpApplicationService {
  constructor(
    private readonly artistRegistryService: IArtistRegistryService,
    private readonly artistProfileService: ArtistProfileService,
    private readonly artistDeleteService: ArtistDeleteService,
  ) {}

  async search(input: {
    q: string;
    limit: number;
    role: UserRole;
    staffRole: import("@auction/types").UserStaffRole | null;
  }): Promise<CatalogHttpJson> {
    const staff = normalizeUserStaffRole(input.staffRole ?? undefined);
    const hits = await this.artistRegistryService.search(input.q, input.limit);
    const data = roleHasCapability(input.role, "artist.read", staff)
      ? hits
      : hits.filter((hit) => hit.status === "approved");
    return okData(data);
  }

  async listPublic(input: { limit: number; offset: number }): Promise<CatalogHttpJson> {
    const data = await this.artistProfileService.listPublic(input);
    return okData(data);
  }

  async browsePublic(input: CatalogArtistBrowseInput): Promise<CatalogHttpJson> {
    const data = await this.artistProfileService.browsePublic({
      limit: input.limit,
      offset: input.offset,
      ...(input.q ? { q: input.q } : {}),
      ...(input.kind ? { kind: input.kind as ArtistKind } : {}),
      ...(input.kinds && input.kinds.length > 0 ? { kinds: input.kinds as ArtistKind[] } : {}),
      ...(input.letter ? { letter: input.letter } : {}),
      ...(input.living === true ? { living: true } : {}),
      ...(input.historical === true ? { historical: true } : {}),
      ...(input.nationality ? { nationality: input.nationality } : {}),
      ...(input.country ? { country: input.country } : {}),
      ...(input.categorySlug ? { categorySlug: input.categorySlug } : {}),
      ...(input.featuredOnly === true ? { featuredOnly: true } : {}),
      ...(input.featuredFirst === true ? { featuredFirst: true } : {}),
      ...(input.decade ? { decade: input.decade } : {}),
      ...(input.hasUpcoming === true ? { hasUpcoming: true } : {}),
      sort: input.sort,
    });
    return okData(data);
  }

  async checkNameAvailability(input: { displayName: string }): Promise<CatalogHttpJson> {
    const result = await this.artistRegistryService.checkNameAvailability(input.displayName);
    return okData(result);
  }

  async proposeMatchesForAdmin(input: {
    userId: string;
    body: ProposeMatchesInput;
  }): Promise<CatalogHttpJson> {
    const result = await this.artistRegistryService.proposeMatchesForAdmin(
      input.userId,
      input.body,
    );
    return okData(result);
  }

  async getAliasesPublic(input: { id: string }): Promise<CatalogHttpJson> {
    const found = await this.artistRegistryService.findById(input.id);
    if (!found || found.status !== "approved" || found.archived) {
      return notFoundJson();
    }
    const detail = await this.artistProfileService.getPublicDetail(input.id);
    return okData(detail?.aliases ?? []);
  }

  async getBySlug(input: {
    slug: string;
    role: UserRole;
    staffRole: import("@auction/types").UserStaffRole | null;
  }): Promise<CatalogHttpJson> {
    const staff = normalizeUserStaffRole(input.staffRole ?? undefined);
    const found = await this.artistRegistryService.findBySlug(input.slug);
    if (!found) return notFoundJson();
    if (!roleHasCapability(input.role, "artist.read", staff) && found.status !== "approved") {
      return notFoundJson();
    }
    return okData(found);
  }

  async getById(input: {
    id: string;
    role: UserRole;
    staffRole: import("@auction/types").UserStaffRole | null;
  }): Promise<CatalogHttpJson> {
    const staff = normalizeUserStaffRole(input.staffRole ?? undefined);
    const found = await this.artistRegistryService.findById(input.id);
    if (!found) return notFoundJson();
    if (!roleHasCapability(input.role, "artist.read", staff) && found.status !== "approved") {
      return notFoundJson();
    }
    return okData(found);
  }

  async create(input: { userId: string; body: CreateArtistInput }): Promise<CatalogHttpJson> {
    const created = await this.artistRegistryService.create(input.userId, input.body);
    return okData(created, 201);
  }

  async addAlias(input: {
    userId: string;
    id: string;
    alias: string;
    kind?: string;
  }): Promise<CatalogHttpJson> {
    const created = await this.artistRegistryService.addAlias(
      input.userId,
      input.id,
      input.alias,
      input.kind,
    );
    return okData(created, 201);
  }

  async mergeWithConfirmation(input: {
    userId: string;
    fromArtistId: string;
    body: MergeArtistRouteInput;
  }): Promise<CatalogHttpJson> {
    try {
      const result = await this.artistRegistryService.mergeWithConfirmation(
        input.userId,
        input.fromArtistId,
        input.body,
      );
      return okData(result);
    } catch (e) {
      if (e instanceof ArtistError) {
        return {
          status: e.status,
          body: { error: e.code ?? "artist_error", message: e.message },
        };
      }
      throw e;
    }
  }

  async review(input: {
    userId: string;
    id: string;
    body: ReviewArtistInput;
  }): Promise<CatalogHttpJson> {
    const updated = await this.artistRegistryService.review(input.userId, input.id, input.body);
    return okData(updated);
  }

  async getDeleteEligibility(input: { id: string }): Promise<CatalogHttpJson> {
    const eligibility = await this.artistDeleteService.getDeleteEligibility(input.id);
    if (!eligibility) return notFoundJson();
    return okData(eligibility);
  }

  async delete(input: {
    userId: string;
    role: UserRole;
    staffRole: string | null;
    id: string;
    confirmationPhrase: string;
  }): Promise<CatalogRouteOutcome<void>> {
    const result = await this.artistDeleteService.delete(
      input.userId,
      input.role,
      input.id,
      input.confirmationPhrase,
      input.staffRole,
    );
    if (result.isErr()) {
      const error = result.error;
      return { kind: "err", error };
    }
    return { kind: "no_content" };
  }
}
