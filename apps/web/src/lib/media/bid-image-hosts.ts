/*
 * Which hosts Bid's image route may fetch pictures from. The list is fixed when the app is built,
 * and it names LAX's own storage and nothing wider: a wildcard over the whole of DigitalOcean
 * Spaces would let the image route fetch, resize and serve a picture from anyone's Space, through
 * LAX's domain and at LAX's cost.
 */

/** LAX's media Spaces: production and test. */
export const LAX_MEDIA_BUCKETS = ["lax-media", "lax-test-media"] as const;

/**
 * The two addresses a Space answers on: its CDN, which is what people are given, and the Space
 * itself, which older records may still carry.
 */
export const LAX_MEDIA_HOSTS: readonly string[] = LAX_MEDIA_BUCKETS.flatMap((bucket) => [
  `${bucket}.lon1.cdn.digitaloceanspaces.com`,
  `${bucket}.lon1.digitaloceanspaces.com`,
]);

/** A plain DNS name: letters, digits and hyphens in dot-separated labels, never a wildcard. */
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function isImageHostname(value: string): boolean {
  return HOSTNAME.test(value);
}

/**
 * Hosts added by the deployment, as a comma-separated list of bare host names. Anything else (a
 * wildcard, a scheme, a path, a port) stops the build rather than widening the list by accident.
 */
export function extraImageHosts(raw: string | undefined): string[] {
  const hosts = (raw ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  for (const host of hosts) {
    if (!isImageHostname(host)) {
      throw new Error(
        `BID_IMAGE_REMOTE_HOSTS has "${host}", which is not a plain host name. Use host names only, with no wildcard, scheme, path or port.`,
      );
    }
  }
  return hosts;
}

/** The host of the public media address the API is configured with, when there is one. */
export function publicMediaHost(baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" && isImageHostname(url.hostname) ? url.hostname : null;
  } catch {
    return null;
  }
}

/** Every host, once, in a fixed order: LAX's Spaces, the public media address, then additions. */
export function bidMediaImageHosts(env: Readonly<Record<string, string | undefined>>): string[] {
  const configured = publicMediaHost(env.S3_PUBLIC_BASE_URL);
  return [
    ...new Set([
      ...LAX_MEDIA_HOSTS,
      ...(configured ? [configured] : []),
      ...extraImageHosts(env.BID_IMAGE_REMOTE_HOSTS),
    ]),
  ];
}
