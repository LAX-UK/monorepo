import { describe, expect, it } from "vitest";
import { reachLabel, searchReachLabel, watchingAlertReach } from "./alert-reach";

const engine = {
  subscribed: { "bid.artists": true, "bid.searches": true },
  email: { "bid.artists": true, "bid.searches": false },
};
const app = { artistAlertsInApp: true, searchAlertsInApp: true };

describe("watchingAlertReach", () => {
  it("reads email and app per topic", () => {
    expect(watchingAlertReach(engine, app)).toEqual({
      artists: { emailOn: true, appOn: true },
      searches: { emailOn: false, appOn: false },
    });
  });

  it("turns the app off with its own switch", () => {
    expect(watchingAlertReach(engine, { ...app, artistAlertsInApp: false })?.artists).toEqual({
      emailOn: true,
      appOn: false,
    });
  });

  it("is unknown when either read failed", () => {
    expect(watchingAlertReach(null, app)).toBeNull();
    expect(watchingAlertReach(engine, null)).toBeNull();
  });
});

describe("labels", () => {
  it("names where an alert reaches the person", () => {
    expect(reachLabel({ emailOn: true, appOn: true })).toBe("email and app");
    expect(reachLabel({ emailOn: true, appOn: false })).toBe("email only");
    expect(reachLabel({ emailOn: false, appOn: false })).toBe("email off");
  });

  it("needs the search's switch and the topic's switch for a search", () => {
    expect(searchReachLabel(true, { emailOn: true, appOn: true })).toBe("email on");
    expect(searchReachLabel(true, { emailOn: false, appOn: false })).toBe("email off");
    expect(searchReachLabel(false, { emailOn: true, appOn: true })).toBe("email off");
    expect(searchReachLabel(true, null)).toBe("email on");
  });
});
