import type { PushClientSnapshot } from "@/lib/push/push-client";

/**
 * "App alerts on this device" as one row: where it stands, in words, and the one thing to do.
 * Every browser state has a line; only states the person can change offer a button.
 */
export type DevicePushView = {
  status: string;
  detail: string;
  action: "turn_on" | "turn_off" | null;
};

export function devicePushView(
  snapshot: PushClientSnapshot & { loading: boolean },
  options: { needsHomeScreen: boolean },
): DevicePushView {
  if (snapshot.loading) {
    return { status: "Checking…", detail: "Looking at this browser's settings.", action: null };
  }
  if (!snapshot.supported) {
    return {
      status: "Not available",
      detail: "This browser can't show app alerts. They still arrive in LAX Bid and by email.",
      action: null,
    };
  }
  if (snapshot.permission === "denied") {
    return {
      status: "Blocked in your browser settings",
      detail: "Allow notifications for this site in your browser, then come back here.",
      action: null,
    };
  }
  if (snapshot.hasBrowserSubscription && snapshot.permission === "granted") {
    return {
      status: "On",
      detail: "The App alerts above also reach this device when LAX Bid is closed.",
      action: "turn_off",
    };
  }
  return {
    status: "Off",
    detail: options.needsHomeScreen
      ? "Add LAX Bid to your home screen first, then turn this on (needed on iPhone)."
      : snapshot.hasServerSubscription
        ? "On for another device. Turn it on here to get alerts on this one too."
        : "Turn on to get the App alerts above on this device when LAX Bid is closed.",
    action: "turn_on",
  };
}
