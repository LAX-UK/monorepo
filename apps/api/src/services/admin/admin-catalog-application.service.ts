import type {
  AdminArtistListOptions,
  AdminCatalogCreateArtistBody,
  AdminCatalogUpdateArtistBody,
} from "../../admin/admin-route-dtos.js";
import type { PlatformCatalogLegalEntityIdProvider } from "../../lib/platform-catalog-legal-entity.js";
import type { ArtistProfileService } from "../artist-profile.service.js";
import type { CategoryService } from "../category.service.js";
import type { IAdminCatalogApplicationService } from "../interfaces/admin-routes.js";
import type { ArtistSearchHit, IArtistRegistryService } from "../interfaces/artist-registry.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "../interfaces/category.js";

export class AdminCatalogApplicationService implements IAdminCatalogApplicationService {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly artistProfileService: ArtistProfileService,
    private readonly artistRegistry: IArtistRegistryService,
    private readonly platformCatalogLegalEntityIdProvider: PlatformCatalogLegalEntityIdProvider,
  ) {}

  listCategoriesForAdmin(input: { includeArchived: boolean }) {
    return this.categoryService.listForAdmin({ includeArchived: input.includeArchived });
  }

  createCategory(body: CreateCategoryInput, actorUserId?: string | null) {
    return this.categoryService.create(body, { actorUserId: actorUserId ?? null });
  }

  getCategory(categoryId: string) {
    return this.categoryService.getForAdmin(categoryId);
  }

  updateCategory(categoryId: string, body: UpdateCategoryInput, actorUserId?: string | null) {
    return this.categoryService.update(categoryId, body, { actorUserId: actorUserId ?? null });
  }

  archiveCategory(categoryId: string, actorUserId?: string | null) {
    return this.categoryService.archive(categoryId, { actorUserId: actorUserId ?? null });
  }

  deleteCategory(categoryId: string, actorUserId?: string | null) {
    return this.categoryService.delete(categoryId, { actorUserId: actorUserId ?? null });
  }

  listArtists(input: AdminArtistListOptions) {
    return this.artistProfileService.listForAdmin(input);
  }

  getArtistStats() {
    return this.artistProfileService.adminArtistStats();
  }

  listArtistDuplicateCandidates(artistId: string): Promise<ArtistSearchHit[]> {
    return this.artistProfileService.listDuplicateCandidates(artistId);
  }

  createArtist(adminUserId: string, body: AdminCatalogCreateArtistBody) {
    return this.artistProfileService.create(adminUserId, body);
  }

  getArtist(artistId: string) {
    return this.artistProfileService.getById(artistId);
  }

  updateArtist(artistId: string, body: AdminCatalogUpdateArtistBody) {
    return this.artistProfileService.update(artistId, body);
  }

  searchArtists(query: string, limit?: number) {
    return this.artistRegistry.search(query, limit);
  }

  resolvePlatformCatalogLegalEntityId() {
    return this.platformCatalogLegalEntityIdProvider();
  }
}
