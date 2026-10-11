import {
  shopAdminAudit,
  shopArtwork,
  shopOrder,
  shopSaleAuthorityRequest,
  shopStaffMember,
  shopUserProfile,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ShopApiError } from "../errors/shop-api-error.js";
import {
  importTestArtwork,
  insertTestStaffMember,
  integrationSuffix,
  requireDefined,
} from "../test-support/shop-fixtures.js";
import { withIsolatedShopAdmins } from "../test-support/shop-integration-admin-roster.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleAdminReadRepository } from "./drizzle-admin-read.repository.js";
import { createDrizzlePortalOwnershipRepository } from "./drizzle-portal-ownership.repository.js";
import { createDrizzleShopUnitOfWork } from "./drizzle-shop-transaction-effects.js";
import { revokeShopStaffRoleInTx } from "./grant-staff-role.js";
import {
  createGrantStaffRoleHandler,
  createRevokeStaffRoleHandler,
} from "./handlers/admin/grant-staff-role.handler.js";
import {
  createLinkArtistIdentityHandler,
  createUnlinkArtistIdentityHandler,
} from "./handlers/admin/link-artist-identity.handler.js";

describe.skipIf(!hasShopIntegrationDb)("shop audit remediation integration", () => {
  let shopPool!: pg.Pool;
  let ownerPool!: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await Promise.allSettled([ownerPool.end(), shopPool.end()]);
  });

  it("pages admin orders with limit=1 when rows share the same millisecond", async () => {
    const db = createShopDb(shopPool);
    const adminRead = createDrizzleAdminReadRepository(db);
    const suffix = integrationSuffix("admin-paging");
    const sameAt = new Date(Date.now() + 86_400_000);

    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const [row] = await db
        .insert(shopOrder)
        .values({
          identitySubjectId: `subject-${suffix}-${i}`,
          fulfilment: "collect_brunswick",
          merchandiseSubtotalPence: 100,
          fulfilmentSurchargePence: 0,
          totalPence: 100,
          idempotencyKey: `idem-${suffix}-${i}`,
          status: "pending_payment",
          createdAt: sameAt,
        })
        .returning({ id: shopOrder.id });
      ids.push(requireDefined(row?.id, "order id"));
    }

    const collected = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 8; page += 1) {
      const pageResult = await adminRead.orders.listOrders({ limit: 1, cursor });
      if (pageResult.items.length === 0) break;
      const orderId = pageResult.items[0]?.orderId;
      if (orderId && ids.includes(orderId)) {
        collected.add(orderId);
      }
      cursor = pageResult.nextCursor ?? undefined;
      if (!cursor || collected.size === ids.length) break;
    }

    expect(collected.size).toBe(3);
  });

  it("links artist identity idempotently, writes audit, and conflicts on duplicate login", async () => {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const linkArtist = createLinkArtistIdentityHandler({ uow });
    const unlinkArtist = createUnlinkArtistIdentityHandler({ uow });
    const suffix = integrationSuffix("artist-link");
    const imported = await importTestArtwork(db, "artist-link");
    const [artworkRow] = await db
      .select({ artistId: shopArtwork.artistId })
      .from(shopArtwork)
      .where(eq(shopArtwork.id, imported.artworkId))
      .limit(1);
    const artistId = requireDefined(artworkRow?.artistId, "artist id");
    const identitySubjectId = `artist-subject-${suffix}`;
    const email = `artist-${suffix}@example.test`;
    await db.insert(shopUserProfile).values({ identitySubjectId, email, name: "Artist Login" });

    const actor = `staff-${suffix}`;
    const idempotencyKey = `link-${suffix}`;

    const first = await linkArtist({
      artistId,
      email,
      actorSubjectId: actor,
      idempotencyKey,
    });
    const replay = await linkArtist({
      artistId,
      email,
      actorSubjectId: actor,
      idempotencyKey,
    });
    expect(replay).toEqual(first);

    const audits = await db
      .select({ action: shopAdminAudit.action })
      .from(shopAdminAudit)
      .where(
        and(
          eq(shopAdminAudit.targetId, artistId),
          eq(shopAdminAudit.action, "link_artist_identity"),
        ),
      );
    expect(audits.length).toBeGreaterThanOrEqual(1);

    const otherImported = await importTestArtwork(db, "artist-link-other");
    const [otherArtwork] = await db
      .select({ artistId: shopArtwork.artistId })
      .from(shopArtwork)
      .where(eq(shopArtwork.id, otherImported.artworkId))
      .limit(1);
    const otherArtistId = requireDefined(otherArtwork?.artistId, "other artist id");

    await expect(
      linkArtist({
        artistId: otherArtistId,
        email,
        actorSubjectId: actor,
        idempotencyKey: `link-conflict-${suffix}`,
      }),
    ).rejects.toMatchObject({
      code: SHOP_API_ERROR_CODES.CONFLICT,
    });

    await unlinkArtist({
      artistId,
      actorSubjectId: actor,
      idempotencyKey: `unlink-${suffix}`,
    });
  });

  it("lets a linked artist create a sale-authority request for their artwork", async () => {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const linkArtist = createLinkArtistIdentityHandler({ uow });
    const portal = createDrizzlePortalOwnershipRepository(db);
    const suffix = integrationSuffix("artist-sar");
    const imported = await importTestArtwork(db, "artist-sar");
    const [artworkRow] = await db
      .select({ artistId: shopArtwork.artistId })
      .from(shopArtwork)
      .where(eq(shopArtwork.id, imported.artworkId))
      .limit(1);
    const artistId = requireDefined(artworkRow?.artistId, "artist id");
    const identitySubjectId = `artist-sar-subject-${suffix}`;
    const email = `artist-sar-${suffix}@example.test`;
    await db.insert(shopUserProfile).values({ identitySubjectId, email, name: "Artist SAR" });
    await linkArtist({
      artistId,
      email,
      actorSubjectId: `staff-${suffix}`,
      idempotencyKey: `link-sar-${suffix}`,
    });

    const created = await portal.createSaleAuthorityRequest({
      identitySubjectId,
      artworkId: imported.artworkId,
      requestedCount: 2,
      note: "integration artist request",
    });
    expect(created.status).toBe("pending");

    const [row] = await db
      .select({ id: shopSaleAuthorityRequest.id })
      .from(shopSaleAuthorityRequest)
      .where(eq(shopSaleAuthorityRequest.id, created.requestId))
      .limit(1);
    expect(row?.id).toBe(created.requestId);
  });

  it("grants a staff role by email through the shop login profile", async () => {
    const db = createShopDb(shopPool);
    const grantStaff = createGrantStaffRoleHandler({ uow: createDrizzleShopUnitOfWork(db, "off") });
    const suffix = integrationSuffix("grant-email");
    const identitySubjectId = `staff-email-${suffix}`;
    const email = `staff-${suffix}@example.test`;
    await db.insert(shopUserProfile).values({ identitySubjectId, email, name: "Staff By Email" });

    const granted = await grantStaff({
      email: email.toUpperCase(),
      role: "broker",
      operatorSubjectId: `operator-${suffix}`,
      idempotencyKey: `grant-email-${suffix}`,
    });

    expect(granted).toEqual({ subject: identitySubjectId });
    const [member] = await db
      .select({ role: shopStaffMember.role })
      .from(shopStaffMember)
      .where(eq(shopStaffMember.identitySubjectId, identitySubjectId));
    expect(member?.role).toBe("broker");
  });

  it("refuses an email grant when no shop login exists", async () => {
    const db = createShopDb(shopPool);
    const grantStaff = createGrantStaffRoleHandler({ uow: createDrizzleShopUnitOfWork(db, "off") });
    const suffix = integrationSuffix("grant-missing");

    await expect(
      grantStaff({
        email: `nobody-${suffix}@example.test`,
        role: "broker",
        operatorSubjectId: `operator-${suffix}`,
        idempotencyKey: `grant-missing-${suffix}`,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns 409 when concurrent revokes would remove the last shop admin", async () => {
    const db = createShopDb(shopPool);
    const uow = createDrizzleShopUnitOfWork(db, "off");
    const revokeStaff = createRevokeStaffRoleHandler({ uow });
    const suffix = integrationSuffix("dual-revoke");
    const adminA = `admin-a-${suffix}`;
    const adminB = `admin-b-${suffix}`;
    await insertTestStaffMember(db, { identitySubjectId: adminA, role: "shop_admin" });
    await insertTestStaffMember(db, { identitySubjectId: adminB, role: "shop_admin" });

    await withIsolatedShopAdmins(db, [adminA, adminB], async () => {
      const operator = `operator-${suffix}`;
      const results = await Promise.allSettled([
        revokeStaff({
          subject: adminA,
          operatorSubjectId: operator,
          idempotencyKey: `revoke-a-${suffix}`,
        }),
        revokeStaff({
          subject: adminB,
          operatorSubjectId: operator,
          idempotencyKey: `revoke-b-${suffix}`,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      const rejectedErr = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedErr).toBeInstanceOf(ShopApiError);
      expect((rejectedErr as ShopApiError).code).toBe(SHOP_API_ERROR_CODES.CONFLICT);
    });
  });

  it("refuses revoking the last active shop admin inside a transaction guard", async () => {
    const db = createShopDb(shopPool);
    const suffix = integrationSuffix("last-admin");
    const soleAdmin = `sole-admin-${suffix}`;
    await insertTestStaffMember(db, { identitySubjectId: soleAdmin, role: "shop_admin" });

    await withIsolatedShopAdmins(db, [soleAdmin], async () => {
      await expect(
        db.transaction(async (tx) =>
          revokeShopStaffRoleInTx(tx, {
            subject: soleAdmin,
            operatorSubjectId: `operator-${suffix}`,
          }),
        ),
      ).rejects.toMatchObject({ code: SHOP_API_ERROR_CODES.CONFLICT });
    });
  });
});
