import type { EmptyStateIllustrationKey } from "@/components/illustrations/empty-state-illustrations";

/** Context drives tone, visuals, and default CTAs (see empty-state UX plan). */
export type EmptyStateContext = "firstUse" | "noResults" | "filtered" | "error" | "completion";

/** Suggested illustration per context when callers omit an explicit key. */
export const CONTEXT_DEFAULT_ILLUSTRATION: Record<
  EmptyStateContext,
  EmptyStateIllustrationKey | null
> = {
  firstUse: "queue",
  noResults: "search",
  filtered: "search",
  error: "error",
  completion: null,
};

/** Voice: 404 human-first; search/filter neutral; first-use encouraging; errors apologetic. */
export const EMPTY_STATE_VOICE = {
  notFoundTitle: "We can't find that page",
  notFoundDescription:
    "The page may have moved, ended, or never existed. Return home or search the catalogue.",
  errorTitle: "Something went wrong",
  errorDescription:
    "Something interrupted this view. Try again or return to a safe starting point.",
  filteredTitle: (entity: string) => `No ${entity} match this filter`,
  searchNoResultsTitle: "No results found",
} as const;

export type AppSegment = "marketing" | "dashboard" | "admin" | "task" | "root";

export const NOT_FOUND_PRESETS = {
  marketing: {
    kicker: "404",
    title: "This page isn't in the gallery",
    description:
      "The page you requested may have moved or never existed. Browse the calendar or return home to keep exploring.",
    primaryHref: "/",
    primaryLabel: "Back to gallery",
    secondaryHref: "/sales",
    secondaryLabel: "Open calendar",
    searchHref: "/search",
    searchLabel: "Search lots",
    illustration: "notFound" as const,
  },
  root: {
    kicker: "404",
    title: "This lot has left the saleroom",
    description:
      "The page you requested is not in the current catalogue. Return to the gallery or search for similar work.",
    primaryHref: "/",
    primaryLabel: "Back to gallery",
    secondaryHref: "/search",
    secondaryLabel: "Search lots",
    illustration: "notFound" as const,
  },
  dashboard: {
    kicker: "404 · Dashboard",
    title: "That section doesn't exist",
    description:
      "The dashboard URL you opened isn't a known route. Return to the overview or browse the catalogue.",
    primaryHref: "/dashboard",
    primaryLabel: "Open dashboard",
    secondaryHref: "/search",
    secondaryLabel: "Browse catalogue",
    illustration: "lots" as const,
  },
  admin: {
    kicker: "404 · Admin",
    title: "That admin route doesn't exist",
    description: "Check the URL or return to the operations cockpit.",
    primaryHref: "/admin",
    primaryLabel: "Operations",
    illustration: "notFound" as const,
  },
  task: {
    kicker: "404",
    title: "That sign-in link isn't valid",
    description: "The page may have expired or the URL is incorrect. Sign in again to continue.",
    primaryHref: "/login",
    primaryLabel: "Sign in",
    secondaryHref: "/",
    secondaryLabel: "Back to gallery",
    illustration: "notFound" as const,
  },
} as const;

export const ROUTE_ERROR_PRESETS = {
  marketing: {
    title: "Something went wrong",
    homeHref: "/",
    homeLabel: "Back to gallery",
  },
  dashboard: {
    title: "Something went wrong",
    homeHref: "/dashboard",
    homeLabel: "Open overview",
  },
  admin: {
    title: "Admin hiccup",
    homeHref: "/admin",
    homeLabel: "Back to admin home",
  },
  task: {
    title: "Something went wrong",
    homeHref: "/login",
    homeLabel: "Sign in",
  },
  root: {
    title: "Something went wrong",
    homeHref: "/",
    homeLabel: "Back to gallery",
  },
} as const;
