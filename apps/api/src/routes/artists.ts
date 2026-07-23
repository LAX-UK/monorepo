import { type UserRole, normalizeUserStaffRole } from "@auction/types";
import {
  artistAddAliasBodySchema,
  artistCheckNameQuerySchema,
  artistDeleteBodySchema,
  artistMergeBodySchema,
  artistProposeMatchesBodySchema,
  artistPublicListQuerySchema,
  artistReviewBodySchema,
  artistRouteCreateBodySchema,
  artistSearchQuerySchema,
  artistSlugParamSchema,
  artistUuidParamSchema,
  publicArtistBrowseQuerySchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { ContainerArtistRoutesSlice } from "../container.js";
import {
  respondCatalogHttpJson,
  respondCatalogRouteOutcome,
} from "../lib/catalog-route-response.js";
import { zValidator } from "../lib/z-validator.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireArtistDelete,
  requireArtistMerge,
  requireArtistRead,
  requireArtistReview,
} from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

/** Only match UUID path segments so static routes (`browse`, `public`, …) are never captured. */
const artistIdSegment =
  ":id{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}}";

export function createArtistRoutes(
  container: ContainerArtistRoutesSlice,
  authenticator: IAuthenticator,
) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const http = () => container.catalogRoutes.artistHttp;
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.get("/search", optionalAuth, zValidator("query", artistSearchQuerySchema), async (c) => {
    const { q, limit } = c.req.valid("query");
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRole = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    return respondCatalogHttpJson(c, await http().search({ q, limit, role, staffRole }));
  });

  r.get("/public", zValidator("query", artistPublicListQuerySchema), async (c) => {
    const { limit, offset } = c.req.valid("query");
    return respondCatalogHttpJson(c, await http().listPublic({ limit, offset }));
  });

  r.get("/browse", zValidator("query", publicArtistBrowseQuerySchema), async (c) => {
    const q = c.req.valid("query");
    return respondCatalogHttpJson(
      c,
      await http().browsePublic({
        limit: q.limit,
        offset: q.offset,
        ...(q.q ? { q: q.q } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.kinds && q.kinds.length > 0 ? { kinds: q.kinds } : {}),
        ...(q.letter ? { letter: q.letter } : {}),
        ...(q.living === true ? { living: true } : {}),
        ...(q.historical === true ? { historical: true } : {}),
        ...(q.nationality ? { nationality: q.nationality } : {}),
        ...(q.country ? { country: q.country } : {}),
        ...(q.categorySlug ? { categorySlug: q.categorySlug } : {}),
        ...(q.featuredOnly === true ? { featuredOnly: true } : {}),
        ...(q.featuredFirst === true ? { featuredFirst: true } : {}),
        ...(q.decade ? { decade: q.decade } : {}),
        ...(q.hasUpcoming === true ? { hasUpcoming: true } : {}),
        sort: q.sort,
      }),
    );
  });

  r.get("/check-name", zValidator("query", artistCheckNameQuerySchema), async (c) => {
    const { displayName } = c.req.valid("query");
    return respondCatalogHttpJson(c, await http().checkNameAvailability({ displayName }));
  });

  r.post(
    "/propose-matches",
    requireAuth,
    requireArtistRead,
    zValidator("json", artistProposeMatchesBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      return respondCatalogHttpJson(c, await http().proposeMatchesForAdmin({ userId, body }));
    },
  );

  r.get(
    `/${artistIdSegment}/aliases-public`,
    zValidator("param", artistUuidParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return respondCatalogHttpJson(c, await http().getAliasesPublic({ id }));
    },
  );

  r.get("/by-slug/:slug", optionalAuth, zValidator("param", artistSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staffRole = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    return respondCatalogHttpJson(c, await http().getBySlug({ slug, role, staffRole }));
  });

  r.get(
    `/${artistIdSegment}`,
    optionalAuth,
    zValidator("param", artistUuidParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      return respondCatalogHttpJson(c, await http().getById({ id, role, staffRole }));
    },
  );

  r.post(
    "/",
    requireAuth,
    requireArtistReview,
    zValidator("json", artistRouteCreateBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      return respondCatalogHttpJson(c, await http().create({ userId, body }));
    },
  );

  r.post(
    `/${artistIdSegment}/aliases`,
    requireAuth,
    requireArtistReview,
    zValidator("param", artistUuidParamSchema),
    zValidator("json", artistAddAliasBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      return respondCatalogHttpJson(
        c,
        await http().addAlias({
          userId,
          id,
          alias: body.alias,
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
        }),
      );
    },
  );

  r.post(
    `/${artistIdSegment}/merge`,
    requireAuth,
    requireArtistMerge,
    zValidator("param", artistUuidParamSchema),
    zValidator("json", artistMergeBodySchema.omit({ fromArtistId: true })),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      return respondCatalogHttpJson(
        c,
        await http().mergeWithConfirmation({ userId, fromArtistId: id, body }),
      );
    },
  );

  r.post(
    `/${artistIdSegment}/review`,
    requireAuth,
    requireArtistReview,
    zValidator("param", artistUuidParamSchema),
    zValidator("json", artistReviewBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      return respondCatalogHttpJson(c, await http().review({ userId, id, body }));
    },
  );

  r.get(
    `/${artistIdSegment}/delete-eligibility`,
    requireAuth,
    requireArtistDelete,
    zValidator("param", artistUuidParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      return respondCatalogHttpJson(c, await http().getDeleteEligibility({ id }));
    },
  );

  r.delete(
    `/${artistIdSegment}`,
    requireAuth,
    requireArtistDelete,
    zValidator("param", artistUuidParamSchema),
    zValidator("json", artistDeleteBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staffRole = c.get("userStaffRole") ?? null;
      const { id } = c.req.valid("param");
      const { confirmationPhrase } = c.req.valid("json");
      return respondCatalogRouteOutcome(
        c,
        await http().delete({
          userId,
          role,
          staffRole,
          id,
          confirmationPhrase,
        }),
      );
    },
  );

  return r;
}
