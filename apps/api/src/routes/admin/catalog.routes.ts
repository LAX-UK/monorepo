import {
  adminArtistListQuerySchema,
  adminCategoryListQuerySchema,
  adminCreateArtistBodySchema,
  adminCreateCategoryBodySchema,
  adminUpdateArtistBodySchema,
  adminUpdateCategoryBodySchema,
  artistIdParamSchema,
  categoryIdParamSchema,
} from "@auction/validators";
import type { ContainerAdminRoutesSlice } from "../../container.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireArtistReviewAccess,
  requireArtistWriteAccess,
  requireArtistsAccess,
  requireCatalogueWrite,
  requireCategoriesAccess,
} from "../../middleware/require-capability.js";
import { adminArtistSearchQuerySchema } from "./_schemas.js";
import { adminArtistIdSegment } from "./_shared.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminCatalogRoutes(
  platform: AdminHono,
  container: ContainerAdminRoutesSlice,
): void {
  platform.get(
    "/categories",
    requireCategoriesAccess,
    zValidator("query", adminCategoryListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.catalog.listCategoriesForAdmin({
        includeArchived: q.includeArchived,
      });
      return c.json({ data });
    },
  );

  platform.post(
    "/categories",
    requireCatalogueWrite,
    zValidator("json", adminCreateCategoryBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      const data = await container.admin.catalog.createCategory(body, c.get("userId") as string);
      return c.json({ data }, 201);
    },
  );

  platform.get(
    "/categories/:categoryId",
    requireCategoriesAccess,
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const data = await container.admin.catalog.getCategory(categoryId);
      if (!data) return c.json({ error: "Not found" }, 404);
      return c.json({ data });
    },
  );

  platform.patch(
    "/categories/:categoryId",
    requireCatalogueWrite,
    zValidator("param", categoryIdParamSchema),
    zValidator("json", adminUpdateCategoryBodySchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const body = c.req.valid("json");
      const data = await container.admin.catalog.updateCategory(
        categoryId,
        body,
        c.get("userId") as string,
      );
      return c.json({ data });
    },
  );

  platform.post(
    "/categories/:categoryId/archive",
    requireCatalogueWrite,
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      const data = await container.admin.catalog.archiveCategory(
        categoryId,
        c.get("userId") as string,
      );
      return c.json({ data });
    },
  );

  platform.delete(
    "/categories/:categoryId",
    requireCatalogueWrite,
    zValidator("param", categoryIdParamSchema),
    async (c) => {
      const { categoryId } = c.req.valid("param");
      await container.admin.catalog.deleteCategory(categoryId, c.get("userId") as string);
      return c.json({ ok: true });
    },
  );

  platform.get("/artists/stats", requireArtistsAccess, async (c) => {
    const data = await container.admin.catalog.getArtistStats();
    return c.json({ data });
  });

  /** Staff registry search for admin pickers — includes pending/rejected; no public approved-only filter. */
  platform.get(
    "/artists/search",
    requireArtistsAccess,
    zValidator("query", adminArtistSearchQuerySchema),
    async (c) => {
      const { q, limit } = c.req.valid("query");
      const data = await container.admin.catalog.searchArtists(q, limit);
      return c.json({ data });
    },
  );

  platform.get(
    "/artists",
    requireArtistsAccess,
    zValidator("query", adminArtistListQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const data = await container.admin.catalog.listArtists({
        includeArchived: q.includeArchived,
        archivedOnly: q.archivedOnly,
        ...(q.q ? { q: q.q } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.kinds ? { kinds: q.kinds } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.ownerUserId ? { ownerUserId: q.ownerUserId } : {}),
        ...(q.categoryId ? { categoryId: q.categoryId } : {}),
        ...(q.country ? { country: q.country } : {}),
        ...(q.featured === true ? { featured: true } : {}),
        ...(q.verified === true ? { verified: true } : {}),
        linked: q.linked,
        sort: q.sort,
        limit: q.limit,
        offset: q.offset,
      });
      return c.json({ data });
    },
  );

  platform.post(
    "/artists",
    requireArtistWriteAccess,
    zValidator("json", adminCreateArtistBodySchema),
    async (c) => {
      const adminUserId = c.get("userId") as string;
      const data = await container.admin.catalog.createArtist(adminUserId, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  );

  platform.get(
    `/artists/${adminArtistIdSegment}/duplicates`,
    requireArtistReviewAccess,
    zValidator("param", artistIdParamSchema),
    async (c) => {
      const { artistId } = c.req.valid("param");
      const data = await container.admin.catalog.listArtistDuplicateCandidates(artistId);
      return c.json({ data });
    },
  );

  platform.get(
    `/artists/${adminArtistIdSegment}`,
    requireArtistsAccess,
    zValidator("param", artistIdParamSchema),
    async (c) => {
      const { artistId } = c.req.valid("param");
      const data = await container.admin.catalog.getArtist(artistId);
      if (!data) return c.json({ error: "Not found" }, 404);
      return c.json({ data });
    },
  );

  platform.patch(
    `/artists/${adminArtistIdSegment}`,
    requireArtistWriteAccess,
    zValidator("param", artistIdParamSchema),
    zValidator("json", adminUpdateArtistBodySchema),
    async (c) => {
      const { artistId } = c.req.valid("param");
      const data = await container.admin.catalog.updateArtist(artistId, c.req.valid("json"));
      return c.json({ data });
    },
  );
}
