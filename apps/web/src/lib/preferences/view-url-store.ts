/** Client-only pub/sub so multiple view switchers stay in sync without Next.js navigation. */

const listeners = new Set<() => void>();

/** Last view chosen on the client (survives canonical URLs that omit `?view=`). */
let clientViewState: string | undefined;

export function subscribeMarketingViewUrl(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (typeof window !== "undefined") {
    const onPopState = () => {
      clientViewState = undefined;
      onStoreChange();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      listeners.delete(onStoreChange);
      window.removeEventListener("popstate", onPopState);
    };
  }
  return () => listeners.delete(onStoreChange);
}

export function notifyMarketingViewUrlChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Update the URL without triggering an App Router RSC refetch (preserves scroll). */
export function replaceMarketingViewUrl(href: string, resolvedView: string): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state, "", href);
  clientViewState = resolvedView;
  notifyMarketingViewUrlChanged();
}

export function readMarketingViewParam(defaultView: string, serverView?: string): string {
  if (typeof window === "undefined") return serverView ?? defaultView;
  if (clientViewState !== undefined) return clientViewState;
  const value = new URLSearchParams(window.location.search).get("view");
  if (value) return value;
  return serverView ?? defaultView;
}

/** @internal Test helper */
export function resetMarketingViewClientState(): void {
  clientViewState = undefined;
}
