import { type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import {
  requireArtistMerge,
  requireArtistRead,
  requireArtistReview,
} from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

const proposeBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).optional(),
});

const createArtistSchema = z.object({
  displayName: z.string().min(1).max(200),
  kind: z.enum(["artist", "maker", "brand", "marque"]).optional(),
  shortBio: z.string().max(1000).optional(),
  nationality: z.string().max(100).optional(),
  birthYear: z.string().max(10).optional(),
  deathYear: z.string().max(10).optional(),
});

const checkNameSchema = z.object({
  displayName: z.string().min(1).max(200),
});

const mergeSchema = z.object({
  intoArtistId: z.string().uuid(),
  fromArtistId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  confirmationPhrase: z.string().min(1).max(500),
});

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().max(1000).optional(),
  rejectionReason: z.string().max(1000).optional(),
});

const addAliasSchema = z.object({
  alias: z.string().min(1).max(200),
  kind: z.string().max(50).optional(),
});

const idParam = z.object({ id: z.string().uuid() });
const slugParam = z.object({ slug: z.string().min(1).max(120) });

export function createArtistRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const r = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();

  /** GET /artists/search?q=…&limit=… — public 3-pass search. */
  r.get("/search", optionalAuth, zValidator("query", searchQuerySchema), async (c) => {
    const { q, limit } = c.req.valid("query");
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    const hits = await container.artistRegistryService.search(q, limit);
    const data = roleHasCapability(role, "artist.read", staff)
      ? hits
      : hits.filter((hit) => hit.status === "approved");
    return c.json({ data });
  });

  /** GET /artists/public — public directory of approved canonical artists.
   * Filters out archived rows, orders by `featured DESC, displayName ASC`.
   * Replaces the legacy `/users/public/artists` endpoint that read from the
   * user table. */
  r.get(
    "/public",
    zValidator(
      "query",
      z.object({
        limit: z.coerce.number().int().min(1).max(100).optional().default(24),
        offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
      }),
    ),
    async (c) => {
      const { limit, offset } = c.req.valid("query");
      const data = await container.artistProfileService.listPublic({ limit, offset });
      return c.json({ data });
    },
  );

  /** POST /artists/propose-matches — admin: surfaces exact + alias + fuzzy buckets. */
  r.post(
    "/propose-matches",
    requireAuth,
    requireArtistRead,
    zValidator("json", proposeBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const result = await container.artistRegistryService.proposeMatchesForAdmin(userId, body);
      return c.json({ data: result });
    },
  );

  r.get("/by-slug/:slug", optionalAuth, zValidator("param", slugParam), async (c) => {
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

  r.get("/check-name", zValidator("query", checkNameSchema), async (c) => {
    const { displayName } = c.req.valid("query");
    const result = await container.artistRegistryService.checkNameAvailability(displayName);
    return c.json({ data: result });
  });

  r.get("/:id", optionalAuth, zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const role = (c.get("userRole") ?? "client") as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    const found = await container.artistRegistryService.findById(id);
    if (!found) return c.json({ error: "Not found" }, 404);
    if (!roleHasCapability(role, "artist.read", staff) && found.status !== "approved") {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: found });
  });

  /** POST /artists — admin-only registry create. Caller is recorded as
   * `created_by_user_id`. Clients never create catalogue identities; they
   * submit items via `/submissions` and admins curate the artist registry.
   */
  r.post(
    "/",
    requireAuth,
    requireArtistReview,
    zValidator("json", createArtistSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const created = await container.artistRegistryService.create(userId, body);
      return c.json({ data: created }, 201);
    },
  );

  /** POST /artists/:id/aliases — add an alias to an existing artist. */
  r.post(
    "/:id/aliases",
    requireAuth,
    requireArtistReview,
    zValidator("param", idParam),
    zValidator("json", addAliasSchema),
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

  /** POST /artists/:id/merge — admin merge. Body specifies the surviving
   * artist via `intoArtistId`; the URL param is the artist being merged.
   */
  r.post(
    "/:id/merge",
    requireAuth,
    requireArtistMerge,
    zValidator("param", idParam),
    zValidator("json", mergeSchema.omit({ fromArtistId: true })),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const canonical = await container.artistRegistryService.findById(body.intoArtistId);
      if (!canonical) {
        return c.json({ error: "canonical_not_found", message: "Target artist not found" }, 404);
      }
      const expected = `MERGE INTO ${canonical.displayName}`;
      if (body.confirmationPhrase !== expected) {
        return c.json(
          {
            error: "confirmation_mismatch",
            message: `Type exactly: ${expected}`,
          },
          400,
        );
      }
      const result = await container.artistRegistryService.merge(userId, {
        fromArtistId: id,
        intoArtistId: body.intoArtistId,
        reason: body.reason,
      });
      return c.json({ data: result });
    },
  );

  /** POST /artists/:id/review — admin: approve or reject a pending artist. */
  r.post(
    "/:id/review",
    requireAuth,
    requireArtistReview,
    zValidator("param", idParam),
    zValidator("json", reviewSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const updated = await container.artistRegistryService.review(userId, id, body);
      return c.json({ data: updated });
    },
  );

  return r;
}
