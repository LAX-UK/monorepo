/** The lot page with its bid dialog open; the page re-checks every rule before it opens. */
export function lotBidHref(lotHref: string): string {
  return `${lotHref}${lotHref.includes("?") ? "&" : "?"}bid=open`;
}
