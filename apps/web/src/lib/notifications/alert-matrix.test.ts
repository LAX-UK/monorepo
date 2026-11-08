import { DEFAULT_NOTIFICATION_PREFERENCES_FORM_VALUES as DEFAULTS } from "@/lib/notifications/notification-preferences-registry";
import { describe, expect, it } from "vitest";
import {
  ALERT_ROWS,
  alertCell,
  alertPresetOf,
  withAlertCell,
  withAlertPreset,
} from "./alert-matrix";

const row = (id: string) => {
  const found = ALERT_ROWS.find((r) => r.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("alert matrix", () => {
  it("has no WhatsApp column and no system terms in its words", () => {
    for (const r of ALERT_ROWS) {
      expect(`${r.label} ${r.description}`).not.toMatch(/whatsapp|submission/i);
      expect(JSON.stringify(r.app)).not.toMatch(/Whatsapp/);
    }
  });

  it("holds the outbid and won emails on, with the reason", () => {
    const values = { ...DEFAULTS, outbidEmail: false };
    expect(alertCell(row("outbid"), "email", values)).toEqual({
      kind: "switch",
      checked: true,
      lockedReason: expect.stringMatching(/^Required while you're bidding/),
    });
    expect(withAlertCell(values, row("outbid"), "email", false).outbidEmail).toBe(false);
    expect(alertCell(row("closing"), "email", values)).toMatchObject({ lockedReason: null });
  });

  it("sets the alert inside LAX Bid and on devices with one App switch", () => {
    const next = withAlertCell(DEFAULTS, row("outbid"), "app", true);
    expect([next.outbidInApp, next.outbidPush]).toEqual([true, true]);
    expect(alertCell(row("sale-ended"), "app", DEFAULTS)).toEqual({ kind: "none" });
  });

  it("knows which preset the alerts match, and a preset never turns a locked alert off", () => {
    const essential = withAlertPreset(DEFAULTS, "essential");
    expect(essential.outbidEmail).toBe(true);
    expect(alertPresetOf(essential)).toBe("essential");
    expect(alertPresetOf(withAlertPreset(DEFAULTS, "quiet"))).toBe("quiet");
    expect(alertPresetOf(withAlertCell(essential, row("watching"), "email", true))).toBeNull();
  });

  it("has a New sales row whose email is the engine's switch and whose app needs a subscription", () => {
    const sales = row("new-sales");
    expect(sales.engineTopic).toBe("bid.new_sales");
    const off = { subscribed: {}, email: {} };
    const on = { subscribed: { "bid.new_sales": true }, email: { "bid.new_sales": true } };
    const appOnly = { subscribed: { "bid.new_sales": true }, email: { "bid.new_sales": false } };
    expect(alertCell(sales, "email", DEFAULTS, on)).toEqual({
      kind: "switch",
      checked: true,
      lockedReason: null,
    });
    expect(alertCell(sales, "email", DEFAULTS, off)).toMatchObject({ checked: false });
    // The app preference defaults on, but nothing arrives until the client is subscribed.
    expect(alertCell(sales, "app", DEFAULTS, off)).toMatchObject({ checked: false });
    expect(alertCell(sales, "app", DEFAULTS, appOnly)).toMatchObject({ checked: true });
    expect(alertCell(sales, "app", { ...DEFAULTS, newSalesInApp: false }, on)).toMatchObject({
      checked: false,
    });
  });

  it("has Artists you follow and Saved searches rows on their own engine topics and app switches", () => {
    const artists = row("artists");
    const searches = row("searches");
    expect([artists.engineTopic, artists.app]).toEqual(["bid.artists", ["artistAlertsInApp"]]);
    expect([searches.engineTopic, searches.app]).toEqual(["bid.searches", ["searchAlertsInApp"]]);
    const engine = {
      subscribed: { "bid.artists": true, "bid.searches": true },
      email: { "bid.artists": true, "bid.searches": false },
    };
    expect(alertCell(artists, "email", DEFAULTS, engine)).toMatchObject({ checked: true });
    expect(alertCell(searches, "email", DEFAULTS, engine)).toMatchObject({ checked: false });
    expect(
      alertCell(searches, "app", { ...DEFAULTS, searchAlertsInApp: false }, engine),
    ).toMatchObject({ checked: false });
    expect(withAlertCell(DEFAULTS, artists, "app", false).artistAlertsInApp).toBe(false);
  });

  it("holds App off with a reason while the email is off for artist and search alerts", () => {
    const emailOff = {
      subscribed: { "bid.artists": true, "bid.searches": true },
      email: { "bid.artists": false, "bid.searches": false },
    };
    for (const id of ["artists", "searches"]) {
      expect(alertCell(row(id), "app", DEFAULTS, emailOff)).toEqual({
        kind: "switch",
        checked: false,
        lockedReason: null,
        disabledReason: "Comes with the email",
      });
    }
    const emailOn = { ...emailOff, email: { "bid.artists": true, "bid.searches": true } };
    expect(alertCell(row("artists"), "app", DEFAULTS, emailOn)).toMatchObject({ checked: true });
    expect(alertCell(row("artists"), "app", DEFAULTS, emailOn)).not.toHaveProperty(
      "disabledReason",
    );
  });

  it("keeps New sales app alerts independent of its email", () => {
    const appOnly = { subscribed: { "bid.new_sales": true }, email: { "bid.new_sales": false } };
    expect(alertCell(row("new-sales"), "app", DEFAULTS, appOnly)).toEqual({
      kind: "switch",
      checked: true,
      lockedReason: null,
    });
  });

  it("shows nothing for New sales when the engine's state could not be read", () => {
    expect(alertCell(row("new-sales"), "email", DEFAULTS, null)).toEqual({ kind: "none" });
  });

  it("is not changed by a style preset", () => {
    expect(withAlertPreset({ ...DEFAULTS, newSalesInApp: false }, "essential").newSalesInApp).toBe(
      false,
    );
  });
});
