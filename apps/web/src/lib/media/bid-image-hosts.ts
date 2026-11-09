/*
 * Which LAX hosts Bid's image route may fetch pictures from. The list is fixed in code, not read
 * from the environment: the image hosts are baked in when the app is built, and the Docker build
 * is given no build arguments, so an environment setting would never reach the shipped app. A
 * wildcard over the whole of DigitalOcean Spaces would let the image route fetch, resize and
 * serve a picture from anyone's Space, through LAX's domain and at LAX's cost, so only LAX's own
 * Spaces are named. A new host is a change to this file.
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
