import type {
  AdminArtistListOptions,
  AdminCatalogCreateArtistBody,
  AdminCatalogUpdateArtistBody,
} from "../../admin/admin-route-dtos.js";
import type { ArtistProfileService } from "../artist-profile.service.js";
import type { CategoryService } from "../category.service.js";
import type { IAdminCatalogApplicationService } from "../interfaces/admin-routes.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "../interfaces/category.js";

export class AdminCatalogApplicationService implements IAdminCatalogApplicationService {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly artistProfileService: ArtistProfileService,
  ) {}

  listCategoriesForAdmin(input: { includeArchived: boolean }) {
    return this.categoryService.listForAdmin({ includeArchived: input.includeArchived });
  }

  createCategory(body: CreateCategoryInput) {
    return this.categoryService.create(body);
  }

  getCategory(categoryId: string) {
    return this.categoryService.getForAdmin(categoryId);
  }

  updateCategory(categoryId: string, body: UpdateCategoryInput) {
    return this.categoryService.update(categoryId, body);
  }

  archiveCategory(categoryId: string) {
    return this.categoryService.archive(categoryId);
  }

  deleteCategory(categoryId: string) {
    return this.categoryService.delete(categoryId);
  }

  listArtists(input: AdminArtistListOptions) {
    return this.artistProfileService.list(input);
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
}
