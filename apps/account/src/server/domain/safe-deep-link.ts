const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * A product's deep link is only followed when it is plain https, or http on a local machine.
 * The portfolio comes from another service, so a link is checked here before it becomes an
 * anchor: `javascript:` and `data:` URLs, and URLs carrying credentials, are dropped.
 */
export function safeDeepLink(href: string | undefined): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol === "https:" || (url.protocol === "http:" && isLocal)) return url.toString();
  return null;
}
