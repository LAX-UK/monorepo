import { notFound } from "next/navigation";

export type ArtMissingContentState = "not_found" | "disabled" | "unavailable" | "error";

/** Signals a transient upstream outage; Next answers 500 so crawlers retry instead of dropping the URL. */
export class ArtContentUnavailableError extends Error {
  constructor(label: string) {
    super(`${label} is temporarily unavailable`);
    this.name = "ArtContentUnavailableError";
  }
}

/**
 * Ends a slug route that has nothing to show with a real HTTP status (404 or 500). Only works
 * while the route renders outside every `loading.tsx` boundary: once a Suspense fallback has
 * flushed, Next can no longer change the 200 and crawlers see a soft 404.
 */
export function notFoundOrUnavailable(state: ArtMissingContentState, label: string): never {
  if (state === "not_found" || state === "disabled") notFound();
  throw new ArtContentUnavailableError(label);
}
