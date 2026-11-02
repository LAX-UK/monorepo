function link(shopOrigin: string, path: string, token: string): string {
  const url = new URL(path, shopOrigin);
  url.searchParams.set("token", token);
  return url.toString();
}

/** Where the confirmation email sends the person. Opening it confirms nothing until they press. */
export function releaseAlertConfirmUrl(shopOrigin: string, token: string): string {
  return link(shopOrigin, "/release-alerts/confirm", token);
}

/** The stop page; it also takes the one-click POST from mail apps. */
export function releaseAlertUnsubscribeUrl(shopOrigin: string, token: string): string {
  return link(shopOrigin, "/release-alerts/unsubscribe", token);
}
