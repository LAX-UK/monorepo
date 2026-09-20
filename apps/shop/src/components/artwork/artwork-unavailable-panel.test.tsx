/** @vitest-environment jsdom */
import { ArtworkUnavailablePanel } from "@/components/artwork/artwork-unavailable-panel";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("ArtworkUnavailablePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("links guests to storefront login with returnTo for notify-me", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={{ kind: "guest", loginHref: "/login", registerHref: "/register" }}
        artworkSlug="reed-study"
        reason="edition_sold_out"
        interestRead={{ status: "ok", data: { subscribed: false } }}
      />,
    );
    const link = screen.getByRole("link", { name: "Sign in to get notified" });
    expect(link.getAttribute("href")).toBe("/login?returnTo=%2Fartworks%2Freed-study");
  });

  it("shows notify button for authenticated viewers when interest loaded", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={{
          kind: "authenticated",
          email: "a@example.com",
          displayName: "Alex",
          accountHref: "/account",
          logoutHref: "/logout",
        }}
        artworkSlug="reed-study"
        reason="edition_sold_out"
        interestRead={{ status: "ok", data: { subscribed: false } }}
      />,
    );
    expect(screen.getByRole("button", { name: "Notify me" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Create a LAX account" })).toBeNull();
  });

  it("still offers registration when interest status failed to load", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={{
          kind: "authenticated",
          email: "a@example.com",
          displayName: "Alex",
          accountHref: "/account",
          logoutHref: "/logout",
        }}
        artworkSlug="reed-study"
        reason="edition_sold_out"
        interestRead={{ status: "failed" as const }}
      />,
    );
    expect(screen.getByRole("button", { name: "Notify me" })).toBeTruthy();
    expect(screen.getByText(/couldn't check your saved preference/i)).toBeTruthy();
    expect(document.querySelector(".shop-detail__interest-panel")).toBeTruthy();
    expect(document.querySelector(".shop-detail__interest-hint")).toBeTruthy();
    expect(document.querySelector(".shop-detail__interest-hint.shop-detail__notice")).toBeNull();
  });

  it("shows enquiry registration for authenticated originals", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={{
          kind: "authenticated",
          email: "a@example.com",
          displayName: "Alex",
          accountHref: "/account",
          logoutHref: "/logout",
        }}
        artworkSlug="string-study"
        reason="price_enquiry"
        interestRead={{ status: "ok", data: { subscribed: false } }}
      />,
    );
    expect(screen.getByRole("button", { name: "Register interest" })).toBeTruthy();
    expect(screen.queryByText(/Join LAX to receive updates/i)).toBeNull();
  });

  it("prompts sign-in again when commerce rejects the session", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={{
          kind: "authenticated",
          email: "a@example.com",
          displayName: "Alex",
          accountHref: "/account",
          logoutHref: "/logout",
        }}
        artworkSlug="string-study"
        reason="price_enquiry"
        interestRead={{ status: "unauthorized" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Sign in again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register interest" })).toBeNull();
  });

  it("does not offer interest actions when the work is sold", () => {
    render(
      <ArtworkUnavailablePanel
        viewer={{ kind: "guest", loginHref: "/login", registerHref: "/register" }}
        artworkSlug="sold-work"
        reason="sold"
        interestRead={{ status: "guest" }}
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/no longer available to purchase/i)).toBeTruthy();
  });
});
