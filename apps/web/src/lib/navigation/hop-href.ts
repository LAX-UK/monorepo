/**
 * A link that changes the account in use: the switch or restore hop, or a page address carrying
 * `?account=` (which the middleware turns into the switch hop). It must be opened as a page load,
 * never by the client router, which cannot carry the hop's cookie through to the layout it keeps.
 *
 * View models return this instead of a bare string. It is an object, so next/link's `<Link href>`
 * and the router's `push` do not accept it: a component has to unwrap it with `hopUrl` to put it
 * in a plain `<a>` or a full load, and the unwrapping is the place a reviewer sees the choice.
 */
export type HopHref = { readonly hop: string };

export function hopHref(url: string): HopHref {
  return { hop: url };
}

export function isHopHref(href: string | HopHref | null | undefined): href is HopHref {
  return typeof href === "object" && href !== null && "hop" in href;
}

/** The address, for a plain `<a>`, `window.location.assign`, or a link that switches first. */
export function hopUrl(href: string | HopHref): string {
  return isHopHref(href) ? href.hop : href;
}
