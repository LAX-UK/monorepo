/**
 * Public pages whose document requests are served from a prerendered copy. The copy has no
 * `loading.tsx` above it, so its HTML carries the page itself (React moves a large page that sits
 * inside a loading boundary out of the HTML and swaps it in with a script, even when prerendered).
 * In-app navigation keeps using the public route, so its loading screen is unchanged.
 */
export const ART_PRERENDERED_ROUTES = {
  "/": "/prerendered/home",
} as const satisfies Readonly<Record<string, string>>;

const PRERENDERED_BY_PUBLIC_PATH: Readonly<Record<string, string>> = ART_PRERENDERED_ROUTES;

const PRERENDERED_PREFIX = "/prerendered/";

/** What the app router asks for when it fetches a page's RSC payload (navigation, prefetch). */
const RSC_CONTENT_TYPE = "text/x-component";

type RequestFacts = {
  method: string;
  pathname: string;
  headers: Pick<Headers, "has" | "get">;
};

/**
 * A request for a whole HTML document: a first visit, a reload, a crawler or a browser without
 * JavaScript. Next removes its own router headers before middleware runs, so the app router's
 * requests are told apart by what they accept and by the browser's fetch metadata.
 */
export function isDocumentRequest(request: Omit<RequestFacts, "pathname">): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.has("next-action")) return false;
  if ((request.headers.get("accept") ?? "").includes(RSC_CONTENT_TYPE)) return false;
  const destination = request.headers.get("sec-fetch-dest");
  return destination === null || destination === "document";
}

/**
 * Where a request for a public page is served from, or null to serve the route it names. Only
 * document requests go to the prerendered copy; in-app navigation, prefetches and server actions
 * reach the public route, which keeps its loading screen.
 */
export function resolvePrerenderedRewrite(request: RequestFacts): string | null {
  const target = PRERENDERED_BY_PUBLIC_PATH[request.pathname];
  return target && isDocumentRequest(request) ? target : null;
}

/** A prerendered copy is not a page of its own: a direct visit goes to the public path. */
export function resolvePrerenderedDirectVisit(pathname: string): string | null {
  if (!pathname.startsWith(PRERENDERED_PREFIX) && pathname !== "/prerendered") return null;
  const entry = Object.entries(PRERENDERED_BY_PUBLIC_PATH).find(
    ([, target]) => target === pathname,
  );
  return entry ? entry[0] : "/";
}
