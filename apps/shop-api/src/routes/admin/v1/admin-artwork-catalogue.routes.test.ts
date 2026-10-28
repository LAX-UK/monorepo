import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import {
  ARTWORK_SLUG_IN_USE_MESSAGE,
  type AdminArtworkDetail,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { ShopDomainError, type ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import type { ArtCacheInvalidator } from "../../../application/ports/art-cache-invalidator.js";
import type {
  AdminArtworkReader,
  ArtistCatalogueWriter,
  ArtworkCatalogueWriter,
} from "../../../application/ports/artwork-catalogue-admin.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import { StaleVersionError } from "../../../errors/stale-version-error.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const IDEMPOTENCY_KEY = "77777777-7777-4777-8777-777777777777";
const headers = {
  authorization: "Bearer admin-token-placeholder-minimum-length",
  "idempotency-key": IDEMPOTENCY_KEY,
};
const ARTWORK = "11111111-1111-4111-8111-111111111111";
const ARTIST = "22222222-2222-4222-8222-222222222222";
const VERSION = "2026-03-01T10:00:00.000Z";

const editable = {
  title: "  Harbour at Dusk  ",
  artistId: ARTIST,
  yearCreated: 2024,
  medium: "  Oil on linen ",
  dimensions: "   ",
  description: null,
  printPricePence: 45_000,
  saleState: "for_sale",
  salesChannel: "shop",
  images: [{ mediaKey: "artwork/a.jpg", alt: "  At dusk " }],
  seoTitle: "",
  seoDescription: null,
};

const cleaned = {
  title: "Harbour at Dusk",
  artistId: ARTIST,
  yearCreated: 2024,
  medium: "Oil on linen",
  dimensions: null,
  description: null,
  printPricePence: 45_000,
  saleState: "for_sale",
  salesChannel: "shop",
  images: [{ mediaKey: "artwork/a.jpg", alt: "At dusk" }],
  seoTitle: null,
  seoDescription: null,
};

type Overrides = {
  reader?: Partial<AdminArtworkReader>;
  writer?: Partial<ArtworkCatalogueWriter>;
  artists?: Partial<ArtistCatalogueWriter>;
  listArtists?: ReturnType<typeof vi.fn>;
  artCache?: ArtCacheInvalidator;
};

async function buildApp(role: ShopStaffRole, overrides: Overrides = {}) {
  // Reset first: a request without a token never reads the mock, so a queued value would leak.
  vi.mocked(verifyBearerToken).mockReset();
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      env: { ...base.env, SHOP_ADMIN_ENABLED: true },
      staffReader: {
        findActiveByIdentitySubject: async (subject) => ({
          roles: [role],
          identitySubjectId: subject,
        }),
        brokerCanAccessClientParty: async () => false,
      },
      admin: {
        ...base.admin,
        adminRead: {
          ...base.admin.adminRead,
          artworks: { ...base.admin.adminRead.artworks, ...overrides.reader },
          parties: {
            ...base.admin.adminRead.parties,
            ...(overrides.listArtists ? { listArtists: overrides.listArtists } : {}),
          },
        },
        artworkCatalogue: { ...base.admin.artworkCatalogue, ...overrides.writer },
        artistCatalogue: { ...base.admin.artistCatalogue, ...overrides.artists },
        artCache: overrides.artCache ?? base.admin.artCache,
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

const reads = [
  { method: "GET", url: "/admin/v1/artworks" },
  { method: "GET", url: `/admin/v1/artworks/${ARTWORK}` },
] as const;

const writes = [
  {
    method: "POST",
    url: "/admin/v1/artworks",
    payload: { ...editable, slug: "harbour-at-dusk", run: { spec: { type: "lax_standard" } } },
  },
  {
    method: "PUT",
    url: `/admin/v1/artworks/${ARTWORK}`,
    payload: { ...editable, expectedVersion: VERSION },
  },
  { method: "POST", url: `/admin/v1/artworks/${ARTWORK}/publish` },
  { method: "POST", url: `/admin/v1/artworks/${ARTWORK}/unpublish` },
  { method: "POST", url: `/admin/v1/artworks/${ARTWORK}/archive` },
  { method: "POST", url: `/admin/v1/artworks/${ARTWORK}/restore` },
  {
    method: "POST",
    url: "/admin/v1/artworks/visibility",
    payload: { action: "publish", artworkIds: [ARTWORK] },
  },
  {
    method: "POST",
    url: "/admin/v1/artists",
    payload: { displayName: "Ada Artist", slug: "ada-artist", discipline: null },
  },
  { method: "POST", url: `/admin/v1/artists/${ARTIST}/archive` },
  { method: "POST", url: `/admin/v1/artists/${ARTIST}/restore` },
] as const;

const WITHOUT_CATALOGUE: ShopStaffRole[] = ["account_manager", "broker", "operations", "finance"];
/** Finance holds artwork_price.write: it may read artworks and set prices, nothing else. */
const WITHOUT_ARTWORK_ACCESS: ShopStaffRole[] = ["account_manager", "broker", "operations"];

const priceWrite = {
  method: "PUT",
  url: `/admin/v1/artworks/${ARTWORK}/price`,
  payload: { printPricePence: 52_000, expectedVersion: VERSION },
} as const;

describe("admin artwork catalogue routes", () => {
  describe("capabilities", () => {
    it.each(WITHOUT_CATALOGUE.flatMap((role) => writes.map((route) => ({ role, route }))))(
      "forbids $role catalogue writes on $route.method $route.url",
      async ({ role, route }) => {
        const app = await buildApp(role);
        const response = await app.inject({ ...route, headers });
        expect(response.statusCode).toBe(403);
        await app.close();
      },
    );

    it.each(WITHOUT_ARTWORK_ACCESS.flatMap((role) => reads.map((route) => ({ role, route }))))(
      "forbids $role reads on $route.method $route.url",
      async ({ role, route }) => {
        const app = await buildApp(role);
        const response = await app.inject({ ...route, headers });
        expect(response.statusCode).toBe(403);
        await app.close();
      },
    );

    it("lets finance read the artwork list to find what to price", async () => {
      const app = await buildApp("finance");
      const response = await app.inject({ ...reads[0], headers });
      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it.each<[ShopStaffRole, number]>([
      ["shop_admin", 200],
      ["finance", 200],
      ["catalogue_editor", 403],
      ["account_manager", 403],
      ["broker", 403],
      ["operations", 403],
    ])("answers %s setting a price with %i", async (role, status) => {
      const setPrice = vi.fn(async () => ({ version: VERSION, refreshesArt: false }));
      const app = await buildApp(role, { writer: { setPrice } });
      const response = await app.inject({ ...priceWrite, headers });
      expect(response.statusCode).toBe(status);
      if (status === 200) {
        expect(setPrice).toHaveBeenCalledWith({
          artworkId: ARTWORK,
          printPricePence: 52_000,
          expectedVersion: VERSION,
          actorSubjectId: `${role}-subject`,
          idempotencyKey: IDEMPOTENCY_KEY,
        });
      } else {
        expect(setPrice).not.toHaveBeenCalled();
      }
      await app.close();
    });

    it("clears the price when it is omitted, and refuses zero", async () => {
      const setPrice = vi.fn(async () => ({ version: VERSION, refreshesArt: false }));
      const app = await buildApp("finance", { writer: { setPrice } });
      await app.inject({ ...priceWrite, payload: { expectedVersion: VERSION }, headers });
      expect(setPrice).toHaveBeenCalledWith(expect.objectContaining({ printPricePence: null }));
      const zero = await app.inject({
        ...priceWrite,
        payload: { printPricePence: 0, expectedVersion: VERSION },
        headers,
      });
      expect(zero.statusCode).toBe(400);
      await app.close();
    });

    it.each([...reads, ...writes, priceWrite])(
      "rejects an unauthenticated $method $url",
      async (route) => {
        const app = await buildApp("shop_admin");
        const response = await app.inject({ method: route.method, url: route.url });
        expect(response.statusCode).toBe(401);
        await app.close();
      },
    );

    it.each([...writes, priceWrite])(
      "requires an idempotency key on $method $url",
      async (route) => {
        const app = await buildApp("shop_admin");
        const { "idempotency-key": _omitted, ...withoutKey } = headers;
        const response = await app.inject({ ...route, headers: withoutKey });
        expect(response.statusCode).toBe(400);
        await app.close();
      },
    );

    it.each<[ShopStaffRole, boolean]>([
      ["shop_admin", true],
      ["catalogue_editor", false],
    ])("tells the writer whether %s may set prices", async (role, canSetPrice) => {
      const updateArtwork = vi.fn(async () => ({ version: VERSION, refreshesArt: false }));
      const app = await buildApp(role, { writer: { updateArtwork } });
      const response = await app.inject({ ...writes[1], headers });
      expect(response.statusCode).toBe(200);
      expect(updateArtwork).toHaveBeenCalledWith(expect.objectContaining({ canSetPrice }));
      await app.close();
    });

    it("answers a price change without price access with 403", async () => {
      const updateArtwork = vi.fn(async () => {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.FORBIDDEN,
          "Setting an edition price needs price access",
          403,
        );
      });
      const app = await buildApp("catalogue_editor", { writer: { updateArtwork } });
      const response = await app.inject({ ...writes[1], headers });
      expect(response.statusCode).toBe(403);
      expect(response.json().message).toBe("Setting an edition price needs price access");
      await app.close();
    });
  });

  describe("reads", () => {
    it("passes the list filters through and returns counts per view", async () => {
      const listArtworks = vi.fn(async () => ({
        items: [],
        nextCursor: null,
        counts: { live: 3, draft: 1, sold_out: 0, archived: 2 },
      }));
      const app = await buildApp("catalogue_editor", { reader: { listArtworks } });
      const response = await app.inject({
        method: "GET",
        url: `/admin/v1/artworks?q=harbour&state=draft&artistId=${ARTIST}&saleState=for_sale&salesChannel=art&sort=updated_asc`,
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().counts).toEqual({ live: 3, draft: 1, sold_out: 0, archived: 2 });
      expect(listArtworks).toHaveBeenCalledWith({
        q: "harbour",
        state: "draft",
        artistId: ARTIST,
        saleState: "for_sale",
        salesChannel: "art",
        sort: "updated_asc",
      });
      await app.close();
    });

    it("rejects an unknown view", async () => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({
        method: "GET",
        url: "/admin/v1/artworks?state=deleted",
        headers,
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it("returns 404 for an unknown artwork", async () => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({ ...reads[1], headers });
      expect(response.statusCode).toBe(404);
      await app.close();
    });

    it("returns staff edition counts on the detail", async () => {
      const detail = {
        artworkId: ARTWORK,
        slug: "harbour-at-dusk",
        title: "Harbour at Dusk",
        artist: { artistId: ARTIST, slug: "ada-artist", displayName: "Ada", archived: false },
        yearCreated: null,
        medium: null,
        dimensions: null,
        description: null,
        run: null,
        printPricePence: 45_000,
        saleState: "for_sale",
        salesChannel: "shop",
        seoTitle: null,
        seoDescription: null,
        images: [],
        importedImageUrl: null,
        editions: {
          size: 24,
          committed: 3,
          byStatus: {
            not_authorised: 10,
            authorised: 11,
            reserved: 1,
            held: 0,
            sold: 2,
            withdrawn: 0,
          },
          byAllocation: { original_buyer_entitlement: 10, artist: 10, lax: 4 },
        },
        state: "live",
        publishBlockers: [],
        publishedAt: VERSION,
        archivedAt: null,
        createdAt: VERSION,
        updatedAt: VERSION,
        version: VERSION,
      } satisfies AdminArtworkDetail;
      const app = await buildApp("catalogue_editor", {
        reader: { getArtwork: async () => detail },
      });
      const response = await app.inject({ ...reads[1], headers });
      expect(response.statusCode).toBe(200);
      expect(response.json().editions.byStatus.sold).toBe(2);
      await app.close();
    });
  });

  describe("writes", () => {
    it("creates with trimmed fields, the slug, the run and the actor", async () => {
      const createArtwork = vi.fn(async () => ({
        artworkId: ARTWORK,
        slug: "harbour-at-dusk",
        version: VERSION,
        refreshesArt: false,
      }));
      const app = await buildApp("shop_admin", { writer: { createArtwork } });
      const response = await app.inject({ ...writes[0], headers });
      expect(response.statusCode).toBe(200);
      expect(createArtwork).toHaveBeenCalledWith({
        ...cleaned,
        slug: "harbour-at-dusk",
        run: { spec: { type: "lax_standard" } },
        canSetPrice: true,
        actorSubjectId: "shop_admin-subject",
        idempotencyKey: IDEMPOTENCY_KEY,
      });
      await app.close();
    });

    it("refuses a blank title after trimming", async () => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({
        ...writes[1],
        payload: { ...editable, title: "   ", expectedVersion: VERSION },
        headers,
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it("refuses a zero price before it reaches the writer", async () => {
      const updateArtwork = vi.fn();
      const app = await buildApp("shop_admin", { writer: { updateArtwork } });
      const response = await app.inject({
        ...writes[1],
        payload: { ...editable, printPricePence: 0, expectedVersion: VERSION },
        headers,
      });
      expect(response.statusCode).toBe(400);
      expect(updateArtwork).not.toHaveBeenCalled();
      await app.close();
    });

    it("passes the version and artwork to an update", async () => {
      const updateArtwork = vi.fn(async () => ({
        version: "2026-03-01T10:05:00.000Z",
        refreshesArt: false,
      }));
      const app = await buildApp("shop_admin", { writer: { updateArtwork } });
      const response = await app.inject({ ...writes[1], headers });
      expect(response.json()).toEqual({ version: "2026-03-01T10:05:00.000Z" });
      expect(updateArtwork).toHaveBeenCalledWith({
        ...cleaned,
        artworkId: ARTWORK,
        expectedVersion: VERSION,
        canSetPrice: true,
        actorSubjectId: "shop_admin-subject",
        idempotencyKey: IDEMPOTENCY_KEY,
      });
      await app.close();
    });

    it("answers a stale save with 409 and the current version", async () => {
      const updateArtwork = vi.fn(async () => {
        throw new StaleVersionError("This artwork", "2026-03-01T10:09:00.000Z");
      });
      const app = await buildApp("shop_admin", { writer: { updateArtwork } });
      const response = await app.inject({ ...writes[1], headers });
      expect(response.statusCode).toBe(409);
      expect(response.json().currentVersion).toBe("2026-03-01T10:09:00.000Z");
      await app.close();
    });

    it("answers a taken slug with 409 and its message", async () => {
      const createArtwork = vi.fn(async () => {
        throw new ShopApiError(SHOP_API_ERROR_CODES.CONFLICT, ARTWORK_SLUG_IN_USE_MESSAGE, 409);
      });
      const app = await buildApp("shop_admin", { writer: { createArtwork } });
      const response = await app.inject({ ...writes[0], headers });
      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe(ARTWORK_SLUG_IN_USE_MESSAGE);
      await app.close();
    });

    it.each(["publish", "unpublish", "archive", "restore"] as const)(
      "sends the %s action for one artwork",
      async (action) => {
        const setVisibility = vi.fn(async () => ({
          version: VERSION,
          state: "live" as const,
          refreshesArt: false,
        }));
        const app = await buildApp("catalogue_editor", { writer: { setVisibility } });
        const response = await app.inject({
          method: "POST",
          url: `/admin/v1/artworks/${ARTWORK}/${action}`,
          headers,
        });
        expect(response.statusCode).toBe(200);
        expect(setVisibility).toHaveBeenCalledWith({
          artworkId: ARTWORK,
          action,
          actorSubjectId: "catalogue_editor-subject",
          idempotencyKey: IDEMPOTENCY_KEY,
        });
        await app.close();
      },
    );

    it("explains a refused publish with 409", async () => {
      const setVisibility = vi.fn(async () => {
        throw new ShopDomainError("Add an image before publishing");
      });
      const app = await buildApp("catalogue_editor", { writer: { setVisibility } });
      const response = await app.inject({ ...writes[2], headers });
      expect(response.statusCode).toBe(409);
      expect(response.json().message).toBe("Add an image before publishing");
      await app.close();
    });

    it("returns one outcome per artwork from a bulk change", async () => {
      const app = await buildApp("catalogue_editor");
      const response = await app.inject({ ...writes[6], headers });
      expect(response.json()).toEqual({ results: [{ artworkId: ARTWORK, outcome: "changed" }] });
      await app.close();
    });

    it("refuses a bulk change of more than a hundred artworks", async () => {
      const app = await buildApp("shop_admin");
      const artworkIds = Array.from(
        { length: 101 },
        (_, index) => `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
      );
      const response = await app.inject({
        method: "POST",
        url: "/admin/v1/artworks/visibility",
        payload: { action: "archive", artworkIds },
        headers,
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });
  });

  describe("artists", () => {
    it("creates an artist with a trimmed name and no blank discipline", async () => {
      const createArtist = vi.fn(async () => ({ artistId: ARTIST, slug: "ada-artist" }));
      const app = await buildApp("catalogue_editor", { artists: { createArtist } });
      const response = await app.inject({
        method: "POST",
        url: "/admin/v1/artists",
        payload: { displayName: "  Ada Artist ", slug: "ada-artist", discipline: "  " },
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(createArtist).toHaveBeenCalledWith({
        displayName: "Ada Artist",
        slug: "ada-artist",
        discipline: null,
        actorSubjectId: "catalogue_editor-subject",
        idempotencyKey: IDEMPOTENCY_KEY,
      });
      await app.close();
    });

    it("refuses a slug with spaces or capitals", async () => {
      const app = await buildApp("shop_admin");
      const response = await app.inject({
        method: "POST",
        url: "/admin/v1/artists",
        payload: { displayName: "Ada", slug: "Ada Artist", discipline: null },
        headers,
      });
      expect(response.statusCode).toBe(400);
      await app.close();
    });

    it.each([
      ["archive", true],
      ["restore", false],
    ] as const)("%ss an artist", async (segment, archived) => {
      const setArtistArchived = vi.fn(async () => ({
        artistId: ARTIST,
        archived,
        refreshesArt: false,
      }));
      const app = await buildApp("catalogue_editor", { artists: { setArtistArchived } });
      const response = await app.inject({
        method: "POST",
        url: `/admin/v1/artists/${ARTIST}/${segment}`,
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(setArtistArchived).toHaveBeenCalledWith(
        expect.objectContaining({ artistId: ARTIST, archived }),
      );
      await app.close();
    });

    it("explains why an artist with live artworks cannot be archived", async () => {
      const setArtistArchived = vi.fn(async () => {
        throw new ShopDomainError("Unpublish or archive the artist's live artwork first");
      });
      const app = await buildApp("shop_admin", { artists: { setArtistArchived } });
      const response = await app.inject({
        method: "POST",
        url: `/admin/v1/artists/${ARTIST}/archive`,
        headers,
      });
      expect(response.statusCode).toBe(409);
      await app.close();
    });

    it("searches artists by name and status", async () => {
      const listArtists = vi.fn(async () => ({ items: [], nextCursor: null }));
      const app = await buildApp("catalogue_editor", { listArtists });
      const response = await app.inject({
        method: "GET",
        url: "/admin/v1/artists?q=ada&status=active",
        headers,
      });
      expect(response.statusCode).toBe(200);
      expect(listArtists).toHaveBeenCalledWith({ q: "ada", status: "active" });
      await app.close();
    });

    it("sorts artists by name or date added on request and rejects unknown sorts", async () => {
      const listArtists = vi.fn(async () => ({
        items: [],
        nextCursor: null,
        counts: { active: 0, archived: 0 },
      }));
      const app = await buildApp("catalogue_editor", { listArtists });
      const sorted = await app.inject({
        method: "GET",
        url: "/admin/v1/artists?sort=created_asc",
        headers,
      });
      expect(sorted.statusCode).toBe(200);
      expect(listArtists).toHaveBeenCalledWith({ sort: "created_asc" });
      const byName = await app.inject({
        method: "GET",
        url: "/admin/v1/artists?sort=name_desc",
        headers,
      });
      expect(byName.statusCode).toBe(200);
      expect(listArtists).toHaveBeenLastCalledWith({ sort: "name_desc" });
      const unknown = await app.inject({
        method: "GET",
        url: "/admin/v1/artists?sort=price_asc",
        headers,
      });
      expect(unknown.statusCode).toBe(400);
      await app.close();
    });
  });
});

describe("lax.art refresh after catalogue writes", () => {
  function invalidator(fails = false) {
    return {
      invalidateEditorial: vi.fn(async () => {}),
      invalidateCatalogue: vi.fn(async () => {
        if (fails) throw new Error("lax.art unreachable");
      }),
    };
  }

  it.each([
    ["publish", "POST", `/admin/v1/artworks/${ARTWORK}/publish`],
    ["unpublish", "POST", `/admin/v1/artworks/${ARTWORK}/unpublish`],
    ["archive", "POST", `/admin/v1/artworks/${ARTWORK}/archive`],
  ] as const)("refreshes artworks after a %s that changed lax.art", async (_name, method, url) => {
    const artCache = invalidator();
    const setVisibility = vi.fn(async () => ({
      version: VERSION,
      state: "draft" as const,
      refreshesArt: true,
    }));
    const app = await buildApp("catalogue_editor", { writer: { setVisibility }, artCache });
    const response = await app.inject({ method, url, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ version: VERSION, state: "draft" });
    await vi.waitFor(() => expect(artCache.invalidateCatalogue).toHaveBeenCalledWith("artworks"));
    await app.close();
  });

  it("refreshes after an update and a bulk change that touched lax.art", async () => {
    const artCache = invalidator();
    const app = await buildApp("shop_admin", {
      artCache,
      writer: {
        updateArtwork: vi.fn(async () => ({ version: VERSION, refreshesArt: true })),
        applyBulkVisibility: vi.fn(async () => ({
          results: [{ artworkId: ARTWORK, outcome: "changed" as const }],
          refreshesArt: true,
        })),
      },
    });
    const update = await app.inject({ ...writes[1], headers });
    expect(update.json()).toEqual({ version: VERSION });
    const bulk = await app.inject({ ...writes[6], headers });
    expect(bulk.json()).toEqual({ results: [{ artworkId: ARTWORK, outcome: "changed" }] });
    await vi.waitFor(() => expect(artCache.invalidateCatalogue).toHaveBeenCalledTimes(2));
    await app.close();
  });

  it("refreshes artists after an artist is archived", async () => {
    const artCache = invalidator();
    const app = await buildApp("catalogue_editor", {
      artCache,
      artists: {
        setArtistArchived: vi.fn(async () => ({
          artistId: ARTIST,
          archived: true,
          refreshesArt: true,
        })),
      },
    });
    const response = await app.inject({ ...writes[8], headers });
    expect(response.json()).toEqual({ artistId: ARTIST, archived: true });
    await vi.waitFor(() => expect(artCache.invalidateCatalogue).toHaveBeenCalledWith("artists"));
    await app.close();
  });

  it("leaves lax.art alone when nothing it serves changed", async () => {
    const artCache = invalidator();
    const app = await buildApp("shop_admin", { artCache });
    await app.inject({ ...writes[0], headers });
    await app.inject({ ...writes[2], headers });
    expect(artCache.invalidateCatalogue).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not run when the write is refused", async () => {
    const artCache = invalidator();
    const setVisibility = vi.fn(async () => {
      throw new ShopDomainError("Add an image before publishing");
    });
    const app = await buildApp("shop_admin", { writer: { setVisibility }, artCache });
    const response = await app.inject({ ...writes[2], headers });
    expect(response.statusCode).toBe(409);
    expect(artCache.invalidateCatalogue).not.toHaveBeenCalled();
    await app.close();
  });

  it("keeps the staff response when lax.art cannot be reached", async () => {
    const artCache = invalidator(true);
    const setVisibility = vi.fn(async () => ({
      version: VERSION,
      state: "live" as const,
      refreshesArt: true,
    }));
    const app = await buildApp("shop_admin", { writer: { setVisibility }, artCache });
    const response = await app.inject({ ...writes[2], headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ version: VERSION, state: "live" });
    await vi.waitFor(() => expect(artCache.invalidateCatalogue).toHaveBeenCalled());
    await app.close();
  });
});
