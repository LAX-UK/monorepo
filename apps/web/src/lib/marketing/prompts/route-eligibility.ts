const ELIGIBLE_EXACT_PATHS = new Set(["/", "/archive", "/artists", "/buy", "/sales", "/search"]);
const ELIGIBLE_PATH_PREFIXES = ["/artist/", "/artists/"];

export function isMarketingPromptRoute(pathname: string): boolean {
  return (
    ELIGIBLE_EXACT_PATHS.has(pathname) ||
    ELIGIBLE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
