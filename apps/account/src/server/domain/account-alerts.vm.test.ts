import { describe, expect, it } from "vitest";
import type { AlertPreferencesRead } from "../ports/alert-preferences-gateway";
import { ALERT_TOPIC_IDS } from "../ports/alert-preferences-gateway";
import {
  ALERT_SECTIONS,
  ALERT_TOPIC_COPY,
  type AlertsPageInput,
  alertRefusalMessage,
  buildAlertsPage,
  maskAlertEmail,
} from "./account-alerts.vm";

const links: AlertsPageInput["links"] = {
  bidSettings: "https://bid.test/settings/notifications",
  shopWaiting: "https://shop.test/account/orders",
  verifyEmail: "https://auth.test/resend-verification",
};

const reads: AlertPreferencesRead = {
  bid: {
    status: "ok",
    topics: [
      { topic: "bid.new_sales", emailOn: true },
      { topic: "bid.artists", emailOn: false },
    ],
  },
  shop: {
    status: "ok",
    topics: [
      { topic: "shop.releases", emailOn: true },
      { topic: "art.followed_artists", emailOn: false },
    ],
    waitingEditions: 2,
  },
};

const input = (patch: Partial<AlertsPageInput> = {}): AlertsPageInput => ({
  reads,
  email: "mahmoud@example.com",
  emailVerified: true,
  links,
  ...patch,
});

describe("alerts page", () => {
  it("lists LAX Bid, LAX Shop and lax.art in that order, every topic with a title", () => {
    const page = buildAlertsPage(input());
    expect(page.sections.map((s) => s.label)).toEqual(["LAX Bid", "LAX Shop", "lax.art"]);
    expect(page.sections[0]?.rows.map((r) => r.title)).toEqual([
      "New sales",
      "Artists you follow",
      "Saved searches",
    ]);
    for (const topic of ALERT_TOPIC_IDS) {
      expect(ALERT_SECTIONS.some((s) => s.topics.includes(topic))).toBe(true);
      expect(ALERT_TOPIC_COPY[topic].title).not.toBe("");
    }
  });

  it("says where the emails go, with the address masked", () => {
    expect(buildAlertsPage(input()).description).toBe(
      "Alert emails from each LAX product, sent to m•••@example.com. At most one email a day from each.",
    );
    expect(buildAlertsPage(input({ email: null })).description).not.toContain("sent to");
    expect(maskAlertEmail("nope")).toBe("•••");
  });

  it("shows a topic the product never reported as off, so a person can start here", () => {
    const bid = buildAlertsPage(input()).sections[0];
    expect(bid?.rows.map((r) => r.emailOn)).toEqual([true, false, false]);
  });

  it("shows the two lax.art and LAX Shop topics from Shop's one answer", () => {
    const [, shop, art] = buildAlertsPage(input()).sections;
    expect(shop?.rows).toMatchObject([{ topic: "shop.releases", emailOn: true }]);
    expect(art?.rows).toMatchObject([{ topic: "art.followed_artists", emailOn: false }]);
  });

  it("keeps the other products when one cannot be loaded", () => {
    const page = buildAlertsPage(input({ reads: { ...reads, shop: { status: "unavailable" } } }));
    const [bid, shop, art] = page.sections;
    expect(bid?.state).toBe("ready");
    expect(shop).toMatchObject({
      state: "unavailable",
      unavailableMessage: "We couldn't load LAX Shop alerts. Try again.",
      rows: [],
    });
    expect(art?.state).toBe("unavailable");
  });

  it("asks for a verified address before alerts can be switched on", () => {
    expect(buildAlertsPage(input()).notice).toBeNull();
    expect(buildAlertsPage(input({ emailVerified: false })).notice).toMatchObject({
      title: "Verify your email",
      link: { href: links.verifyEmail },
    });
  });

  it("points Bid's app alerts, artists and searches at Bid's own settings", () => {
    expect(buildAlertsPage(input()).sections[0]?.note?.link?.href).toBe(links.bidSettings);
    expect(
      buildAlertsPage(input({ links: { ...links, bidSettings: null } })).sections[0]?.note,
    ).toBeNull();
  });

  it("counts the editions a person is waiting for in LAX Shop", () => {
    const note = buildAlertsPage(input()).sections[1]?.note;
    expect(note?.text).toContain("2 editions are available again");
    expect(note?.link).toEqual({ href: links.shopWaiting, label: "View" });
    const one = buildAlertsPage(
      input({
        reads: {
          ...reads,
          shop: { status: "ok", topics: [], waitingEditions: 1 },
        },
      }),
    ).sections[1]?.note;
    expect(one?.text).toContain("1 edition is available again");
    const none = buildAlertsPage(
      input({ reads: { ...reads, shop: { status: "ok", topics: [], waitingEditions: 0 } } }),
    ).sections[1]?.note;
    expect(none).toBeNull();
  });

  it("explains each refusal in plain words", () => {
    expect(alertRefusalMessage("unverified")).toContain("Verify your email");
    expect(alertRefusalMessage("blocked")).toContain("Contact us");
    expect(alertRefusalMessage("no_account")).toContain("Sign in again");
  });
});
