import { createEngineHarness } from "@auction/alerts/testing";
import { describe, expect, it, vi } from "vitest";
import type { PortalFavoritesHandlers } from "../handlers/portal-favorites.handler.js";
import { createAlertingPortalFavorites } from "./alerting-portal-favorites.js";
import { FollowAlertsService } from "./follow-alerts.service.js";

function setup() {
  const h = createEngineHarness();
  const warn = vi.fn();
  const alerts = new FollowAlertsService({
    subscribe: h.subscribe,
    subscribers: h.stores,
    log: { warn },
  });
  h.accounts.set("sub-1", { email: "Collector@Example.com", verified: true });
  const emailsOn = async (subject: string) => {
    const row = await h.stores.findBySubject("art", subject);
    if (!row) return null;
    return (await h.stores.list(row.id)).some(
      (t) => t.topic === "art.followed_artists" && t.emailOn,
    );
  };
  return { h, alerts, warn, emailsOn };
}

describe("following an artist on lax.art", () => {
  it("switches emails on at once for a verified account, with the follow wording as consent", async () => {
    const { h, alerts, emailsOn } = setup();
    await alerts.onFollowed("sub-1", "followed");
    expect(await emailsOn("sub-1")).toBe(true);
    const row = h.stores.subscribersById.values().next().value;
    expect(row).toMatchObject({
      product: "art",
      email: "collector@example.com",
      status: "confirmed",
    });
    expect(h.mailer.confirmations).toHaveLength(0);
  });

  it("does not need an email address to follow: an account without one is simply not alerted", async () => {
    const { h, alerts, emailsOn } = setup();
    h.accounts.set("sub-2", { email: "x@example.com", verified: false });
    await alerts.onFollowed("sub-2", "followed");
    await alerts.onFollowed("sub-3", "followed");
    expect(await emailsOn("sub-2")).toBeNull();
    expect(await emailsOn("sub-3")).toBeNull();
  });

  it("leaves a person who stopped all alerts stopped when they follow again", async () => {
    const { h, alerts } = setup();
    await alerts.onFollowed("sub-1", "followed");
    const row = await h.stores.findBySubject("art", "sub-1");
    await h.stores.stop(row?.id ?? "", "link", h.now);
    await alerts.onFollowed("sub-1", "followed");
    expect((await h.stores.findBySubject("art", "sub-1"))?.status).toBe("stopped");
  });

  it("leaves a follow that already existed as the person set it", async () => {
    const { h, alerts, emailsOn } = setup();
    await alerts.onFollowed("sub-1", "followed");
    const row = await h.stores.findBySubject("art", "sub-1");
    await h.stores.setEmail(row?.id ?? "", "art.followed_artists", false, "person", h.now);
    await alerts.onFollowed("sub-1", "already_followed");
    expect(await emailsOn("sub-1")).toBe(false);
  });

  it("starts alerts for an existing follower who never had them", async () => {
    const { alerts, emailsOn } = setup();
    await alerts.onFollowed("sub-1", "already_followed");
    expect(await emailsOn("sub-1")).toBe(true);
  });

  it("never fails the follow when alerts cannot be switched on", async () => {
    const { alerts, warn } = setup();
    const broken = new FollowAlertsService({
      subscribe: {
        enableForAccount: async () => {
          throw new Error("database unavailable");
        },
      },
      subscribers: { findBySubject: async () => null },
      log: { warn },
    });
    await expect(broken.onFollowed("sub-1", "followed")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(alerts).toBeDefined();
  });
});

describe("favourites with alerts", () => {
  const favorites = (outcome: "followed" | "already_followed" | "not_found" | "removed") =>
    ({
      followArtist: vi.fn(async () => outcome),
      unfollowArtist: vi.fn(async () => "removed" as const),
    }) as unknown as PortalFavoritesHandlers;

  it("switches the emails on after a follow and passes the outcome through", async () => {
    const onFollowed = vi.fn(async () => undefined);
    const wrapped = createAlertingPortalFavorites(favorites("followed"), { onFollowed });
    expect(await wrapped.followArtist("sub-1", "iris-calder")).toBe("followed");
    expect(onFollowed).toHaveBeenCalledWith("sub-1", "followed");
  });

  it("does nothing for an unknown artist, and leaves unfollowing alone", async () => {
    const onFollowed = vi.fn(async () => undefined);
    const base = favorites("not_found");
    const wrapped = createAlertingPortalFavorites(base, { onFollowed });
    expect(await wrapped.followArtist("sub-1", "nobody")).toBe("not_found");
    expect(await wrapped.unfollowArtist("sub-1", "iris-calder")).toBe("removed");
    expect(onFollowed).not.toHaveBeenCalled();
  });
});
