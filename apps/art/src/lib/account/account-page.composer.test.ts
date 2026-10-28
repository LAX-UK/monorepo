import { GUEST_VIEWER, SIGNED_IN_VIEWER, fakeArtServices } from "@/lib/testing/fake-art-services";
import { describe, expect, it } from "vitest";
import {
  composeArtAccountEnquiriesPage,
  composeArtAccountFollowsPage,
  composeArtAccountOverviewPage,
  composeArtAccountSavesPage,
  mergeEnquiryStates,
} from "./account-page.composer.js";

describe("account page composers", () => {
  it("redirects guests to sign in with a return path", async () => {
    await expect(composeArtAccountOverviewPage(fakeArtServices(GUEST_VIEWER))).resolves.toEqual({
      kind: "redirect",
      to: "/login?returnTo=%2Faccount",
    });
  });

  it("redirects disabled accounts", async () => {
    const services = fakeArtServices({ kind: "disabled", message: "Disabled" });
    await expect(composeArtAccountEnquiriesPage(services)).resolves.toEqual({
      kind: "redirect",
      to: "/account/disabled",
    });
  });

  it("reports unavailable identity without redirecting", async () => {
    const services = fakeArtServices({ kind: "unavailable", message: "Account offline" });
    await expect(composeArtAccountOverviewPage(services)).resolves.toEqual({
      kind: "unavailable",
      message: "Account offline",
    });
  });

  it("leads with enquiries and links profile things to LAX Account", async () => {
    const result = await composeArtAccountOverviewPage(fakeArtServices(SIGNED_IN_VIEWER));
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm).toMatchObject({
      banner: null,
      enquiries: { kind: "empty" },
      moreEnquiries: false,
    });
    expect(result.identity).toEqual({
      name: "Ada Collector",
      email: "ada@example.com",
      initials: "AC",
    });
    expect(result.nav.map((item) => [item.label, item.active])).toEqual([
      ["Overview", true],
      ["Enquiries", false],
    ]);
    expect(result.vm.destinations.map((row) => [row.title, row.href])).toEqual([
      ["Favourites", "/account/favourites"],
      ["Following", "/account/favourites/follows"],
      ["Manage your details in LAX Account", "https://account.example.test/home"],
    ]);
    expect(result.vm.promos.map((promo) => promo.href)).toEqual([
      "/how-to-buy",
      "/how-to-sell",
      "/help",
    ]);
  });

  it("never shows a plain buyer Collection or Payouts", async () => {
    const result = await composeArtAccountOverviewPage(fakeArtServices(SIGNED_IN_VIEWER));
    if (result.kind !== "ok") throw new Error("expected ok");
    const titles = result.vm.destinations.map((row) => row.title);
    expect(titles).not.toContain("Payouts");
    expect(titles.join(" ")).not.toMatch(/collection$/i);
  });

  it("shows Payouts, in LAX Account, to a payee", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.portal.loadSellerAccess.mockResolvedValue({
      status: "ok",
      data: { editions: true, payouts: true, artist: false },
    });
    const result = await composeArtAccountOverviewPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.destinations.find((row) => row.id === "payouts")).toMatchObject({
      href: "https://account.example.test/sellingPayouts",
      external: true,
    });
  });

  it("keeps Payouts hidden when the seller lookup fails", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.portal.loadSellerAccess.mockResolvedValue({ status: "failed" });
    const result = await composeArtAccountOverviewPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.destinations.map((row) => row.id)).not.toContain("payouts");
  });

  it("shows the latest three enquiries and offers the rest", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.portal.listGeneralEnquiries.mockResolvedValue({
      status: "ok",
      data: [1, 2, 3, 4].map((day) => ({
        enquiryId: `g${day}`,
        topic: "general" as const,
        contextSlug: null,
        message: "Hello",
        phone: null,
        createdAt: `2026-04-0${day}T10:00:00.000Z`,
      })),
    });
    const result = await composeArtAccountOverviewPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiries).toMatchObject({
      kind: "ok",
      items: [{ id: "g4" }, { id: "g3" }, { id: "g2" }],
    });
    expect(result.vm.moreEnquiries).toBe(true);
  });

  it("counts saved works and followed artists on their rows", async () => {
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
    services.favorites.listFollowedArtists.mockResolvedValue({ status: "failed" });
    const result = await composeArtAccountOverviewPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.destinations.slice(0, 2).map((row) => row.countLabel)).toEqual(["1", null]);
  });

  it("shows the incomplete-profile banner for an unverified email", async () => {
    const result = await composeArtAccountOverviewPage(
      fakeArtServices({ ...SIGNED_IN_VIEWER, emailVerified: false }),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.banner).toMatchObject({ title: "You're almost ready" });
  });

  it("sends a missing phone number to the LAX Account profile through the banner", async () => {
    const result = await composeArtAccountOverviewPage(
      fakeArtServices({ ...SIGNED_IN_VIEWER, verifiedPhone: null }),
    );
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.banner?.action).toEqual({
      label: "Add phone number",
      href: "https://account.example.test/profile",
    });
  });

  it("maps saved artworks into cards on the Saves tab", async () => {
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
    const result = await composeArtAccountSavesPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.artworks).toMatchObject({ kind: "ok", items: [{ slug: "a", saved: true }] });
    expect(result.nav.find((item) => item.active)?.id).toBe("saves");
    expect(services.favorites.listFollowedArtists).not.toHaveBeenCalled();
  });

  it("reports an empty Saves tab", async () => {
    const result = await composeArtAccountSavesPage(fakeArtServices(SIGNED_IN_VIEWER));
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.artworks).toEqual({ kind: "empty" });
  });

  it("lists followed artists on the Follows tab", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.favorites.listFollowedArtists.mockResolvedValue({
      status: "ok",
      data: [
        {
          artistSlug: "artist",
          artistName: "Artist",
          portraitUrl: null,
          followedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const result = await composeArtAccountFollowsPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.artists).toMatchObject({
      kind: "ok",
      items: [{ slug: "artist", following: true }],
    });
    expect(result.nav.find((item) => item.active)?.href).toBe("/account/favourites/follows");
    expect(services.favorites.listSavedArtworks).not.toHaveBeenCalled();
  });

  it("redirects guests from the Follows tab with its own return path", async () => {
    await expect(composeArtAccountFollowsPage(fakeArtServices(GUEST_VIEWER))).resolves.toEqual({
      kind: "redirect",
      to: "/login?returnTo=%2Faccount%2Ffavourites%2Ffollows",
    });
  });

  it("merges artwork and general enquiries newest first", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.portal.listEnquiries.mockResolvedValue({
      status: "ok",
      data: [
        {
          enquiryId: "a1",
          artworkId: "w1",
          artworkSlug: "warm-basket",
          artworkTitle: "Warm Basket",
          salesChannel: "art",
          intent: "enquiry",
          status: "open",
          createdAt: "2026-03-01T10:00:00.000Z",
        },
      ],
    });
    services.portal.listGeneralEnquiries.mockResolvedValue({
      status: "ok",
      data: [
        {
          enquiryId: "g1",
          topic: "general",
          contextSlug: null,
          message: "Hello",
          phone: null,
          createdAt: "2026-04-01T10:00:00.000Z",
        },
      ],
    });
    const result = await composeArtAccountEnquiriesPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiries).toMatchObject({
      kind: "ok",
      items: [{ id: "g1" }, { id: "a1" }],
    });
    expect(result.nav.find((item) => item.active)?.id).toBe("enquiries");
  });

  it("is empty when neither read has enquiries", async () => {
    const result = await composeArtAccountEnquiriesPage(fakeArtServices(SIGNED_IN_VIEWER));
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiries).toEqual({ kind: "empty" });
  });

  it("asks for sign-in again when the BFF session lapsed", async () => {
    const services = fakeArtServices(SIGNED_IN_VIEWER);
    services.portal.listEnquiries.mockResolvedValue({ status: "unauthorized" });
    const result = await composeArtAccountEnquiriesPage(services);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.vm.enquiries).toEqual({
      kind: "sign_in",
      loginHref: "/login?returnTo=%2Faccount%2Fenquiries",
    });
  });
});

describe("mergeEnquiryStates", () => {
  const item = {
    id: "a",
    variant: "artwork" as const,
    typeLabel: "Artwork enquiry",
    title: "T",
    description: null,
    href: null,
    status: null,
    createdAtIso: "2026-01-01T00:00:00.000Z",
    createdAtLabel: "1 Jan 2026",
  };

  it("keeps showing items when the other read failed", () => {
    expect(mergeEnquiryStates({ kind: "ok", items: [item] }, { kind: "failed" })).toEqual({
      kind: "ok",
      items: [item],
    });
  });

  it("fails only when nothing can be shown", () => {
    expect(mergeEnquiryStates({ kind: "empty" }, { kind: "failed" })).toEqual({ kind: "failed" });
  });

  it("asks to sign in again when either side lapsed", () => {
    const signIn = { kind: "sign_in" as const, loginHref: "/login" };
    expect(mergeEnquiryStates({ kind: "ok", items: [item] }, signIn)).toEqual(signIn);
  });
});
