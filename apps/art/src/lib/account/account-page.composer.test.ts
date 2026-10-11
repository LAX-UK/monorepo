import { GUEST_VIEWER, SIGNED_IN_VIEWER, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  buildArtCollectionRows,
  composeArtAccountCollectionPage,
  composeArtAccountFavoritesPage,
  composeArtAccountInquiriesPage,
  composeArtAccountPayoutsPage,
  composeArtAccountProfilePage,
} from "./account-page.composer.js";

describe("account page composers", () => {
  it("redirects guests to sign in with a return path", async () => {
    await expect(composeArtAccountProfilePage(fakeArtServices(GUEST_VIEWER))).resolves.toEqual({
      kind: "redirect",
      to: "/login?returnTo=%2Faccount",
    });
  });

  it("redirects disabled accounts", async () => {
    const services = fakeArtServices({ kind: "disabled", message: "Disabled" });
    await expect(composeArtAccountInquiriesPage(services)).resolves.toEqual({
      kind: "redirect",
      to: "/account/disabled",
    });
  });

  it("reports unavailable identity without redirecting", async () => {
    const services = fakeArtServices({ kind: "unavailable", message: "Account offline" });
    await expect(composeArtAccountProfilePage(services)).resolves.toEqual({
      kind: "unavailable",
      message: "Account offline",
    });
  });

  it("builds a read-only profile with the env-provided LAX Account link", async () => {
    const result = await composeArtAccountProfilePage(fakeArtServices(SIGNED_IN_VIEWER));
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm).toEqual({
      name: "Ada Collector",
      email: "ada@example.com",
      phone: "+447700900123",
      emailVerified: true,
      laxAccountHref: "https://account.example.test/account",
      verifyEmailHref: null,
    });
    expect(result.nav.map((item) => item.label)).toEqual([
      "Profile",
      "Inquiries",
      "Collection",
      "Favorites",
    ]);
  });

  it("hides the LAX Account link when the env var is missing", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.account.laxAccountHref.mockReturnValue(null);
    const result = await composeArtAccountProfilePage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.laxAccountHref).toBeNull();
  });

  it("maps favorites into card grids and empty states", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.favorites.listSavedArtworks.mockResolvedValue({
      status: "ok",
      data: [
        {
          artworkSlug: "a",
          artworkTitle: "A",
          artistName: "Artist",
          artistSlug: "artist",
          imageUrl: null,
          salesChannel: "art",
          savedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const result = await composeArtAccountFavoritesPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.artworks).toMatchObject({ kind: "ok", items: [{ slug: "a", saved: true }] });
    expect(result.vm.artists).toEqual({ kind: "empty" });
    expect(result.nav.find((item) => item.active)?.href).toBe("/account/favorites");
  });

  it("asks for sign-in again when the BFF session lapsed", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.portal.listEnquiries.mockResolvedValue({ status: "unauthorized" });
    const result = await composeArtAccountInquiriesPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiries).toEqual({
      kind: "sign_in",
      loginHref: "/login?returnTo=%2Faccount%2Finquiries",
    });
  });

  it("reports failed collection reads", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.portal.listCollection.mockResolvedValue({ status: "commerce_unavailable" });
    const result = await composeArtAccountCollectionPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.collection).toEqual({ kind: "failed" });
  });

  it("hides payouts unless the flag is on", async () => {
    await expect(composeArtAccountPayoutsPage(fakeArtServices(SIGNED_IN_VIEWER))).resolves.toEqual({
      kind: "not_found",
    });
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.account.payoutsEnabled.mockReturnValue(true);
    const result = await composeArtAccountPayoutsPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.payouts).toEqual({ kind: "failed" });
    expect(result.nav.at(-1)).toMatchObject({ href: "/account/payouts", active: true });
  });
});

describe("buildArtCollectionRows", () => {
  it("links only lax.art works and labels editions", () => {
    expect(
      buildArtCollectionRows([
        {
          kind: "edition",
          editionId: "e1",
          artworkId: "a1",
          artworkSlug: "print",
          artworkTitle: "Print",
          salesChannel: "shop",
          editionNumber: 4,
          listingStatus: "unlisted",
          custodyStatus: "held",
        },
        {
          kind: "original",
          originalSaleId: "s1",
          artworkId: "a2",
          artworkSlug: "oil",
          artworkTitle: "Oil",
          salesChannel: "art",
          status: "completed",
          acquiredAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        key: "edition-e1",
        title: "Print",
        href: null,
        kindLabel: "Edition #4",
        sourceLabel: "LAX Shop",
        detail: null,
      },
      {
        key: "original-s1",
        title: "Oil",
        href: "/artworks/oil",
        kindLabel: "Original",
        sourceLabel: "lax.art",
        detail: "Acquired 1 Jan 2026",
      },
    ]);
  });
});
