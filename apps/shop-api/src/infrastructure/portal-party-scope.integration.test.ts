import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopDocument,
  shopEdition,
  shopOriginalSale,
  shopParty,
  shopPayeeConnectAccount,
  shopSaleAuthorityRequest,
} from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { ShopConnectGateway } from "../application/ports/shop-connect.gateway.js";
import { createDrizzlePortalOwnershipRepository } from "./drizzle-portal-ownership.repository.js";
import { createDrizzlePortalPortfolioRepository } from "./drizzle-portal-portfolio.repository.js";
import { createDrizzleShopPayeeConnectAccountRepository } from "./drizzle-shop-payee-connect-account.repository.js";
import { createDrizzleShopPayeeConnectService } from "./drizzle-shop-payee-connect.service.js";
import { InvoicesCategory } from "./subject-export/categories/invoices.category.js";
import { OrdersCategory } from "./subject-export/categories/orders.category.js";
import { SellingCategory } from "./subject-export/categories/selling.category.js";

const ownerUrl = process.env.MIGRATION_TEST_DATABASE_URL;
const ORIGINS = { shop: "https://shop.example", art: "https://art.example" };
const PLATFORM = "party-scope-test";
const RETURN = "https://shop.example/account/payouts";

function fakeGateway() {
  let next = 0;
  return {
    createAccount: vi.fn(async () => ({ stripeAccountId: `acct_scope_${++next}` })),
    retrieveAccountFlags: vi.fn(),
    createOnboardingLink: vi.fn(async () => ({
      url: "https://connect.stripe.test/onboard",
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    })),
    createAccountSession: vi.fn(async () => "secret_scope"),
    createTransfer: vi.fn(),
  } satisfies ShopConnectGateway;
}

/**
 * A gallery party, signed in as itself, represents two linked artists. A third artist has an
 * unclaimed party of their own. The rule in `portal-party-scope.ts` decides what each sees and
 * which payout account each may reach. Rolled back, so it leaves no rows behind.
 */
describe.skipIf(!ownerUrl)("portal party scope (integration)", () => {
  it("keeps an artist on a shared gallery party to their own works and off its payout account", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by ownerUrl
    const db = createDb(ownerUrl!);
    const rollback = new Error("rollback_test_tx");
    const tag = randomUUID().slice(0, 8);
    const id = () => randomUUID();
    const subjects = {
      a: `scope-artist-a-${tag}`,
      b: `scope-artist-b-${tag}`,
      solo: `scope-artist-solo-${tag}`,
      c: `scope-artist-c-${tag}`,
      gallery: `scope-gallery-${tag}`,
    };
    const [gallery, soloParty, unclaimedShared, ownC] = [id(), id(), id(), id()];
    const [artistA, artistB, artistSolo, artistC, artistD] = [id(), id(), id(), id(), id()];
    const [workA, workB, workSolo] = [id(), id(), id()];
    const [editionA, editionB] = [id(), id()];
    const [originalA, originalB] = [id(), id()];
    const [requestA, requestB] = [id(), id()];
    const [galleryDoc, soloDoc] = [id(), id()];

    try {
      await db.transaction(async (tx) => {
        await tx.insert(shopParty).values([
          {
            id: gallery,
            displayName: "Gallery",
            kind: "gallery",
            identitySubjectId: subjects.gallery,
          },
          { id: soloParty, displayName: "Solo Artist" },
          { id: unclaimedShared, displayName: "Unclaimed Studio" },
          { id: ownC, displayName: "Artist C", identitySubjectId: subjects.c },
        ]);
        await tx.insert(shopArtist).values([
          { id: artistA, partyId: gallery, slug: `a-${tag}`, identitySubjectId: subjects.a },
          { id: artistB, partyId: gallery, slug: `b-${tag}`, identitySubjectId: subjects.b },
          {
            id: artistSolo,
            partyId: soloParty,
            slug: `solo-${tag}`,
            identitySubjectId: subjects.solo,
          },
          {
            id: artistC,
            partyId: unclaimedShared,
            slug: `c-${tag}`,
            identitySubjectId: subjects.c,
          },
          { id: artistD, partyId: unclaimedShared, slug: `d-${tag}` },
        ]);
        const work = (artworkId: string, artistId: string, name: string) => ({
          id: artworkId,
          slug: `${name}-${tag}`,
          title: name,
          artistId,
          eligibleForEditionAllocation: true,
          importKey: `party-scope:${artworkId}`,
        });
        await tx
          .insert(shopArtwork)
          .values([
            work(workA, artistA, "work-a"),
            work(workB, artistB, "work-b"),
            work(workSolo, artistSolo, "work-solo"),
          ]);
        const held = (editionId: string, artworkId: string) => ({
          id: editionId,
          artworkId,
          editionNumber: 1,
          stockRef: 1,
          allocation: "artist" as const,
          ownerPartyId: gallery,
          listingStatus: "authorised" as const,
        });
        await tx.insert(shopEdition).values([held(editionA, workA), held(editionB, workB)]);
        const bought = (saleId: string, artworkId: string) => ({
          id: saleId,
          artworkId,
          buyerPartyId: gallery,
          status: "assigned" as const,
          salePricePence: 30_000,
          recordedBySubjectId: "staff-1",
        });
        await tx
          .insert(shopOriginalSale)
          .values([bought(originalA, workA), bought(originalB, workB)]);
        await tx.insert(shopSaleAuthorityRequest).values([
          { id: requestA, artworkId: workA, ownerPartyId: gallery, requestedCount: 1 },
          { id: requestB, artworkId: workB, ownerPartyId: gallery, requestedCount: 1 },
        ]);
        await tx.insert(shopDocument).values([
          {
            id: galleryDoc,
            partyId: gallery,
            kind: "purchase_invoice",
            objectKey: `party-scope/${galleryDoc}.pdf`,
          },
          {
            id: soloDoc,
            partyId: soloParty,
            kind: "purchase_invoice",
            objectKey: `party-scope/${soloDoc}.pdf`,
          },
        ]);

        const scopedDb = tx as never;

        // --- Payout account (Stripe Connect) ---
        const gateway = fakeGateway();
        const accounts = createDrizzleShopPayeeConnectAccountRepository(scopedDb, PLATFORM);
        const connect = createDrizzleShopPayeeConnectService({
          db: scopedDb,
          accounts,
          gateway,
          publishableKey: null,
          storefrontOrigins: ORIGINS,
          failClosedConnectUrls: true,
        });
        const managedByGallery = {
          code: SHOP_API_ERROR_CODES.CONFLICT,
          statusCode: 409,
          message: "Your payout account is managed by your gallery",
        };
        for (const subject of [subjects.a, subjects.b]) {
          await expect(connect.getStatusForSubject(subject)).rejects.toMatchObject(
            managedByGallery,
          );
          await expect(connect.ensureAccountForSubject(subject)).rejects.toMatchObject(
            managedByGallery,
          );
          await expect(
            connect.createOnboardingLinkForSubject(subject, RETURN, RETURN),
          ).rejects.toMatchObject(managedByGallery);
          for (const surface of ["onboarding", "management"] as const) {
            await expect(
              connect.createAccountSessionForSubject(subject, surface),
            ).rejects.toMatchObject(managedByGallery);
          }
        }
        expect(gateway.createAccount).not.toHaveBeenCalled();
        expect(gateway.createAccountSession).not.toHaveBeenCalled();
        expect(gateway.createOnboardingLink).not.toHaveBeenCalled();

        // The gallery, signed in as itself, opens and manages the account on its own party.
        const galleryAccount = await connect.ensureAccountForSubject(subjects.gallery);
        await expect(
          connect.createOnboardingLinkForSubject(subjects.gallery, RETURN, RETURN),
        ).resolves.toMatchObject({ url: "https://connect.stripe.test/onboard" });
        await expect(
          connect.createAccountSessionForSubject(subjects.gallery, "management"),
        ).resolves.toEqual({ clientSecret: "secret_scope" });
        await expect(connect.getStatusForSubject(subjects.gallery)).resolves.toMatchObject({
          accountLinked: true,
        });
        expect(gateway.createAccount).toHaveBeenCalledTimes(1);
        expect(gateway.createAccount).toHaveBeenCalledWith(
          expect.objectContaining({ partyId: gallery }),
        );
        // Once the gallery has one, the artists still cannot reach it.
        await expect(
          connect.createAccountSessionForSubject(subjects.a, "management"),
        ).rejects.toMatchObject(managedByGallery);
        expect((await accounts.findForParty(gallery))?.stripeConnectAccountId).toBe(
          galleryAccount.stripeAccountId,
        );

        // An artist on their own unclaimed party: the account is opened on a party of their own
        // sign-in, and payouts owed to the artist party reach it.
        const soloAccount = await connect.ensureAccountForSubject(subjects.solo);
        const [soloOwnParty] = await tx
          .select({ id: shopParty.id })
          .from(shopParty)
          .where(eq(shopParty.identitySubjectId, subjects.solo));
        expect(soloOwnParty).toBeDefined();
        expect(gateway.createAccount).toHaveBeenLastCalledWith(
          expect.objectContaining({ partyId: soloOwnParty?.id }),
        );
        expect((await accounts.findForParty(soloParty))?.stripeConnectAccountId).toBe(
          soloAccount.stripeAccountId,
        );

        // A party several artists share, with no sign-in of its own, pays into no artist's account.
        await expect(connect.getStatusForSubject(subjects.c)).rejects.toMatchObject(
          managedByGallery,
        );
        await tx.insert(shopPayeeConnectAccount).values({
          partyId: ownC,
          stripePlatformKey: PLATFORM,
          stripeConnectAccountId: `acct_scope_c_${tag}`,
        });
        expect(await accounts.findForParty(unclaimedShared)).toBeNull();

        const accountParties = await tx
          .select({ partyId: shopPayeeConnectAccount.partyId })
          .from(shopPayeeConnectAccount)
          .where(eq(shopPayeeConnectAccount.stripePlatformKey, PLATFORM));
        expect(accountParties.map((row) => row.partyId).sort()).toEqual(
          [gallery, soloOwnParty?.id, ownC].sort(),
        );

        // --- Portal readers and the data export ---
        const ownership = createDrizzlePortalOwnershipRepository(scopedDb);
        const portfolio = createDrizzlePortalPortfolioRepository(scopedDb);
        const deps = { db: scopedDb, files: { sign: async () => null } as never, origins: ORIGINS };
        const invoices = new InvoicesCategory(deps);
        const selling = new SellingCategory(deps);
        const orders = new OrdersCategory(deps);
        const exported = async (
          category: InvoicesCategory | SellingCategory | OrdersCategory,
          subject: string,
        ) => {
          const page = await category.readPage(subject, null);
          expect(await category.count(subject)).toBe(page.records.length);
          return JSON.stringify(page.records);
        };
        const seen = async (subject: string) => {
          const [documents, collection, editions, authority, requests, facts] = await Promise.all([
            ownership.listDocuments(subject),
            ownership.listCollection(subject),
            ownership.listOwnedEditions(subject),
            ownership.listSaleAuthority(subject),
            ownership.listSaleAuthorityRequests(subject),
            portfolio.loadFacts(subject, { includeSales: false }),
          ]);
          const [invoiceExport, sellingExport, ordersExport] = await Promise.all([
            exported(invoices, subject),
            exported(selling, subject),
            exported(orders, subject),
          ]);
          const has = (text: string, ids: string[]) => ids.filter((x) => text.includes(x)).sort();
          return {
            documents: documents.map((row) => row.documentId).sort(),
            collection: collection
              .map((row) => (row.kind === "edition" ? row.editionId : row.originalSaleId))
              .sort(),
            editions: editions.map((row) => row.editionId).sort(),
            authority: authority.map((row) => row.artworkId).sort(),
            requests: requests.map((row) => row.requestId).sort(),
            portfolio: [
              ...facts.editions.map((row) => row.editionId),
              ...facts.originals.map((row) => row.originalSaleId),
            ].sort(),
            invoiceExport: has(invoiceExport, [galleryDoc, soloDoc]),
            sellingExport: has(sellingExport, [requestA, requestB]),
            ordersExport: has(ordersExport, [originalA, originalB]),
          };
        };
        const sorted = (...ids: string[]) => [...ids].sort();

        expect(await seen(subjects.a)).toEqual({
          documents: [],
          collection: sorted(editionA, originalA),
          editions: [editionA],
          authority: [workA],
          requests: [requestA],
          portfolio: sorted(editionA, originalA),
          invoiceExport: [],
          sellingExport: [requestA],
          ordersExport: [originalA],
        });
        expect(await seen(subjects.gallery)).toEqual({
          documents: [galleryDoc],
          collection: sorted(editionA, editionB, originalA, originalB),
          editions: sorted(editionA, editionB),
          authority: sorted(workA, workB),
          requests: sorted(requestA, requestB),
          portfolio: sorted(editionA, editionB, originalA, originalB),
          invoiceExport: [galleryDoc],
          sellingExport: sorted(requestA, requestB),
          ordersExport: sorted(originalA, originalB),
        });
        expect((await seen(subjects.solo)).documents).toEqual([soloDoc]);
        expect((await seen(subjects.solo)).invoiceExport).toEqual([soloDoc]);

        // Writes follow the same rule: another artist's request and artwork are out of reach.
        await expect(
          ownership.withdrawSaleAuthorityRequest(subjects.a, requestB),
        ).rejects.toMatchObject({ statusCode: 404 });
        await expect(
          ownership.createSaleAuthorityRequest({
            identitySubjectId: subjects.a,
            artworkId: workB,
            requestedCount: 0,
          }),
        ).rejects.toMatchObject({ statusCode: 403 });
        const [stillPending] = await tx
          .select({ status: shopSaleAuthorityRequest.status })
          .from(shopSaleAuthorityRequest)
          .where(inArray(shopSaleAuthorityRequest.id, [requestB]));
        expect(stillPending?.status).toBe("pending");

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
