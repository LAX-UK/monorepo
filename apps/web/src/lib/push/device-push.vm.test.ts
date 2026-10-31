import { describe, expect, it } from "vitest";
import { devicePushView } from "./device-push.vm";

const base = {
  loading: false,
  supported: true,
  permission: "default" as const,
  hasBrowserSubscription: false,
  hasServerSubscription: false,
};
const opts = { needsHomeScreen: false };

describe("devicePushView", () => {
  it("is off with a way to turn it on", () => {
    expect(devicePushView(base, opts)).toMatchObject({ status: "Off", action: "turn_on" });
  });

  it("is on with a way to turn it off", () => {
    expect(
      devicePushView({ ...base, permission: "granted", hasBrowserSubscription: true }, opts),
    ).toMatchObject({ status: "On", action: "turn_off" });
  });

  it("says when the browser blocks it or can't do it, with no button", () => {
    expect(devicePushView({ ...base, permission: "denied" }, opts)).toMatchObject({
      status: "Blocked in your browser settings",
      action: null,
    });
    expect(devicePushView({ ...base, supported: false }, opts)).toMatchObject({
      status: "Not available",
      action: null,
    });
  });

  it("explains the home screen step on iPhone and another device's subscription", () => {
    expect(devicePushView(base, { needsHomeScreen: true }).detail).toMatch(/home screen/);
    expect(devicePushView({ ...base, hasServerSubscription: true }, opts).detail).toMatch(
      /another device/,
    );
  });
});
