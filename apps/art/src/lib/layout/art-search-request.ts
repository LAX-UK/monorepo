/** The bottom bar's Search tab asks the header's search to open; the header listens. */
export const ART_SEARCH_REQUEST_EVENT = "lax-art:open-search";

export function requestArtSearch(): void {
  window.dispatchEvent(new Event(ART_SEARCH_REQUEST_EVENT));
}
