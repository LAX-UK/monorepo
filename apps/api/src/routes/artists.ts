import { type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
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
import type { Container } from "../container.js";
import { ArtistError } from "../lib/errors.js";
import { serviceErrorJsonBody } from "../lib/forbidden-response.js";
import { asHttpStatus } from "../lib/http-status.js";
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

export function createArtistRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  r.get("/search", optionalAuth, zValidator("query", artistSearchQuerySchema), async (c) => {
    const { q, limit } = c.req.valid("query");
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    const hits = await container.artistRegistryService.search(q, limit);
    const data = roleHasCapability(role, "artist.read", staff)
      ? hits
      : hits.filter((hit) => hit.status === "approved");
    return c.json({ data });
  });

  r.get("/public", zValidator("query", artistPublicListQuerySchema), async (c) => {
    const { limit, offset } = c.req.valid("query");
    const data = await container.artistProfileService.listPublic({ limit, offset });
    return c.json({ data });
  });

  r.get("/browse", zValidator("query", publicArtistBrowseQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const data = await container.artistProfileService.browsePublic({
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
    });
    return c.json({ data });
  });

  r.get("/check-name", zValidator("query", artistCheckNameQuerySchema), async (c) => {
    const { displayName } = c.req.valid("query");
    const result = await container.artistRegistryService.checkNameAvailability(displayName);
    return c.json({ data: result });
  });

  r.post(
    "/propose-matches",
    requireAuth,
    requireArtistRead,
    zValidator("json", artistProposeMatchesBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const result = await container.artistRegistryService.proposeMatchesForAdmin(userId, body);
      return c.json({ data: result });
    },
  );

  r.get(
    `/${artistIdSegment}/aliases-public`,
    zValidator("param", artistUuidParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const found = await container.artistRegistryService.findById(id);
      if (!found || found.status !== "approved" || found.archived) {
        return c.json({ error: "Not found" }, 404);
      }
      const detail = await container.artistProfileService.getPublicDetail(id);
      return c.json({ data: detail?.aliases ?? [] });
    },
  );

  r.get("/by-slug/:slug", optionalAuth, zValidator("param", artistSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    const found = await container.artistRegistryService.findBySlug(slug);
    if (!found) return c.json({ error: "Not found" }, 404);
    if (!roleHasCapability(role, "artist.read", staff) && found.status !== "approved") {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: found });
  });

  r.get(
    `/${artistIdSegment}`,
    optionalAuth,
    zValidator("param", artistUuidParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const role = (c.get("userRole") ?? "client") as UserRole;
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const found = await container.artistRegistryService.findById(id);
      if (!found) return c.json({ error: "Not found" }, 404);
      if (!roleHasCapability(role, "artist.read", staff) && found.status !== "approved") {
        return c.json({ error: "Not found" }, 404);
      }
      return c.json({ data: found });
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
      const created = await container.artistRegistryService.create(userId, body);
      return c.json({ data: created }, 201);
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
      const created = await container.artistRegistryService.addAlias(
        userId,
        id,
        body.alias,
        body.kind,
      );
      return c.json({ data: created }, 201);
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
      try {
        const result = await container.artistRegistryService.mergeWithConfirmation(
          userId,
          id,
          body,
        );
        return c.json({ data: result });
      } catch (e) {
        if (e instanceof ArtistError) {
          return c.json(
            { error: e.code ?? "artist_error", message: e.message },
            asHttpStatus(e.status),
          );
        }
        throw e;
      }
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
      const updated = await container.artistRegistryService.review(userId, id, body);
      return c.json({ data: updated });
    },
  );

  r.get(
    `/${artistIdSegment}/delete-eligibility`,
    requireAuth,
    requireArtistDelete,
    zValidator("param", artistUuidParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const eligibility = await container.artistDeleteService.getDeleteEligibility(id);
      if (!eligibility) {
        return c.json({ error: "Not found" }, 404);
      }
      return c.json({ data: eligibility });
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
      const result = await container.artistDeleteService.delete(
        userId,
        role,
        id,
        confirmationPhrase,
        staffRole,
      );
      if (result.isErr()) {
        const error = result.error;
        return c.json(serviceErrorJsonBody(error), asHttpStatus(error.status));
      }
      return c.body(null, 204);
    },
  );

  return r;
}
