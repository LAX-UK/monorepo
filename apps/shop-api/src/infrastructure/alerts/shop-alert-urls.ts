import type { AlertUrls } from "@auction/alerts";

const trim = (url: string) => url.replace(/\/$/, "");

function link(origin: string, path: string, token: string): string {
  return `${trim(origin)}${path}?token=${encodeURIComponent(token)}`;
}

/**
 * LAX Shop's links, on the pages Shop already serves: opening the confirm link changes nothing
 * until the button is pressed, and the stop address also takes the mail app's one-click POST.
 */
export function shopAlertUrls(origin: string, manageUrl: string | null = null): AlertUrls {
  const stop = (token: string) => link(origin, "/release-alerts/unsubscribe", token);
  return {
    confirm: (token) => link(origin, "/release-alerts/confirm", token),
    stop,
    oneClick: stop,
    manage: () => manageUrl,
    changeTimeZone: () => null,
    site: (path) => `${trim(origin)}${path}`,
  };
}

/**
 * lax.art's links. Followers are switched on from their account, so no one confirms by email on
 * lax.art; the confirm address exists only to satisfy the engine's shape.
 */
export function artAlertUrls(origin: string, manageUrl: string | null = null): AlertUrls {
  const stop = (token: string) => link(origin, "/alerts/unsubscribe", token);
  return {
    confirm: (token) => link(origin, "/alerts/confirm", token),
    stop,
    oneClick: stop,
    manage: () => manageUrl,
    changeTimeZone: () => null,
    site: (path) => `${trim(origin)}${path}`,
  };
}
