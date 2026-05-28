import {
  DASHBOARD_CTA,
  DASHBOARD_ROUTES,
  dashboardLoginUrl,
  supportMailto,
} from "@/lib/dashboard/dashboard-copy";
import {
  buildLegalEntityAccessFailure,
  isLegalEntityAccessCode,
} from "@/lib/legal-entity/legal-entity-access-errors";
import { parseApiErrorCodeFromBody } from "@auction/validators";

export type DashboardSlice =
  | "session"
  | "bids"
  | "portfolio"
  | "payments"
  | "watchlist"
  | "artistFollow"
  | "activeLots"
  | "notifications"
  | "addresses"
  | "sellerLots"
  | "sellerPayouts"
  | "sellerConnect"
  | "categories"
  | "legalEntities"
  | "submissions"
  | "orgMembers"
  | "invitations"
  | "checkout"
  | "kyc"
  | "orgOnboarding"
  | "settings";

export type DashboardActionKind =
  | "retry"
  | "signIn"
  | "use_personal_profile"
  | "support"
  | "navigate";

export type DashboardAction = {
  kind: DashboardActionKind;
  label: string;
  href?: string;
};

export type DashboardSliceFailure = {
  slice: DashboardSlice;
  code: string | null;
  status: number;
  title: string;
  message: string;
  actions: DashboardAction[];
};

/** Thrown by HTTP readers when a dashboard slice fetch fails. */
export class DashboardFetchError extends Error {
  readonly detail: {
    slice: DashboardSlice;
    status: number;
    code: string | null;
  };

  constructor(detail: { slice: DashboardSlice; status: number; code: string | null }) {
    super(`dashboard_fetch:${detail.slice}:${detail.status}`);
    this.name = "DashboardFetchError";
    this.detail = detail;
  }

  toFailure(): DashboardSliceFailure {
    return buildDashboardSliceFailure(this.detail.slice, this.detail.status, this.detail.code);
  }
}

type SliceDefaults = {
  title: string;
  message: (status: number) => string;
  retryHref: string;
};

const SLICE_DEFAULTS: Record<DashboardSlice, SliceDefaults> = {
  session: {
    title: "Session issue",
    message: (s) =>
      s === 401 ? "Your session expired. Sign in again." : "Could not load your account session.",
    retryHref: DASHBOARD_ROUTES.signIn,
  },
  bids: {
    title: "Could not load bids",
    message: () => "Something went wrong while loading your bids. Try again.",
    retryHref: DASHBOARD_ROUTES.bids,
  },
  portfolio: {
    title: "Could not load collection",
    message: () => "Something went wrong while loading your collection. Try again.",
    retryHref: DASHBOARD_ROUTES.portfolio,
  },
  payments: {
    title: "Could not load payments",
    message: () => "Something went wrong while loading your payments. Try again.",
    retryHref: DASHBOARD_ROUTES.payments,
  },
  watchlist: {
    title: "Could not load watchlist",
    message: () => "Something went wrong while loading your watchlist. Try again.",
    retryHref: DASHBOARD_ROUTES.watchlist,
  },
  artistFollow: {
    title: "Could not load followed artists",
    message: () => "Something went wrong while loading followed artists. Try again.",
    retryHref: DASHBOARD_ROUTES.artistFollow,
  },
  activeLots: {
    title: "Could not load live inventory",
    message: () => "Something went wrong while loading live lots. Try again.",
    retryHref: DASHBOARD_ROUTES.overview,
  },
  notifications: {
    title: "Could not load notifications",
    message: () => "Something went wrong while loading notifications. Try again.",
    retryHref: DASHBOARD_ROUTES.notifications,
  },
  addresses: {
    title: "Could not load addresses",
    message: () => "Something went wrong while loading your addresses. Try again.",
    retryHref: "/dashboard/settings/addresses",
  },
  sellerLots: {
    title: "Could not load your lots",
    message: () => "Something went wrong while loading your lots. Try again.",
    retryHref: DASHBOARD_ROUTES.sellerInSale,
  },
  sellerPayouts: {
    title: "Could not load payouts",
    message: (s) =>
      s === 401
        ? "Your session expired. Sign in again."
        : s === 403
          ? "You do not have permission to view payouts for this entity."
          : "Could not load payouts. Please try again later.",
    retryHref: DASHBOARD_ROUTES.sellerPayouts,
  },
  sellerConnect: {
    title: "Could not load Stripe setup",
    message: () => "Something went wrong while loading payout setup. Try again.",
    retryHref: DASHBOARD_ROUTES.sellerConnect,
  },
  categories: {
    title: "Could not load categories",
    message: () => "Something went wrong while loading categories. Try again.",
    retryHref: DASHBOARD_ROUTES.watchlist,
  },
  legalEntities: {
    title: "Could not load organisations",
    message: () => "Something went wrong while loading your organisations. Try again.",
    retryHref: DASHBOARD_ROUTES.organisations,
  },
  submissions: {
    title: "Could not load submissions",
    message: () => "Something went wrong while loading your submissions. Try again.",
    retryHref: DASHBOARD_ROUTES.submissions,
  },
  orgMembers: {
    title: "Could not load members",
    message: () => "Something went wrong while loading members. Try again.",
    retryHref: DASHBOARD_ROUTES.organisations,
  },
  invitations: {
    title: "Could not load invitations",
    message: () => "Something went wrong while loading invitations. Try again.",
    retryHref: DASHBOARD_ROUTES.invitations,
  },
  checkout: {
    title: "Checkout issue",
    message: () => "Something went wrong preparing checkout. Try again.",
    retryHref: "/dashboard/checkout",
  },
  kyc: {
    title: "Verification unavailable",
    message: () => "Could not load identity verification status. Try again.",
    retryHref: "/dashboard/verify-identity",
  },
  orgOnboarding: {
    title: "Onboarding status unavailable",
    message: () => "Could not load organisation onboarding status.",
    retryHref: DASHBOARD_ROUTES.organisations,
  },
  settings: {
    title: "Settings unavailable",
    message: () => "Something went wrong. Try again.",
    retryHref: "/dashboard/settings",
  },
};

function defaultActions(defaults: SliceDefaults, status: number): DashboardAction[] {
  const actions: DashboardAction[] = [];
  if (status === 401) {
    actions.push({
      kind: "signIn",
      label: DASHBOARD_CTA.signInAgain,
      href: dashboardLoginUrl(defaults.retryHref),
    });
  } else {
    actions.push({ kind: "retry", label: DASHBOARD_CTA.tryAgain, href: defaults.retryHref });
  }
  return actions;
}

/** Maps HTTP status + API error code to stable dashboard copy for a slice. */
export function buildDashboardSliceFailure(
  slice: DashboardSlice,
  status: number,
  code: string | null,
): DashboardSliceFailure {
  if (code && isLegalEntityAccessCode(code)) {
    const context =
      slice === "submissions" ? "submissions" : slice === "orgMembers" ? "members" : "general";
    const le = buildLegalEntityAccessFailure(context, status, code);
    return { slice, ...le };
  }

  const defaults = SLICE_DEFAULTS[slice];
  return {
    slice,
    code,
    status,
    title: defaults.title,
    message: defaults.message(status),
    actions: defaultActions(defaults, status),
  };
}

/** Parses `{ error, code, errorCode }` from a failed API response body. */
export async function parseApiErrorCode(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => ({}))) as {
    error?: unknown;
    errorCode?: string;
    code?: string;
  };
  return parseApiErrorCodeFromBody(body);
}

/** Throws {@link DashboardFetchError} for a non-OK response. */
export async function throwIfNotOk(res: Response, slice: DashboardSlice): Promise<void> {
  if (res.ok) return;
  const code = await parseApiErrorCode(res);
  throw new DashboardFetchError({ slice, status: res.status, code });
}

/** Normalises any caught error into structured dashboard copy. */
export function describeDashboardSliceFailure(
  error: unknown,
  slice: DashboardSlice,
  fallbackMessage: string,
): DashboardSliceFailure {
  if (error instanceof DashboardFetchError) {
    return error.toFailure();
  }
  if (error && typeof error === "object" && "failure" in error) {
    const f = (error as { failure: DashboardSliceFailure }).failure;
    if (f && typeof f === "object" && "message" in f && "title" in f) {
      return f;
    }
  }
  const legacy = parseLegacyFetchMessage(error);
  if (legacy) {
    return buildDashboardSliceFailure(slice, legacy.status, null);
  }
  return {
    ...buildDashboardSliceFailure(slice, 500, null),
    message: error instanceof Error ? error.message : fallbackMessage,
  };
}

/** Compact message for overview bullet lists. */
export function dashboardSliceFailureMessage(
  error: unknown,
  slice: DashboardSlice,
  fallback: string,
): string {
  return describeDashboardSliceFailure(error, slice, fallback).message;
}

/** Parses legacy ``Failed to load X: 403`` errors during migration. */
function parseLegacyFetchMessage(error: unknown): { status: number } | null {
  if (!(error instanceof Error)) return null;
  const m = error.message.match(/:\s*(\d{3})\s*$/);
  if (!m?.[1]) return null;
  const status = Number.parseInt(m[1], 10);
  return Number.isFinite(status) ? { status } : null;
}

/** Maps settings / action redirect error strings to friendly copy. */
export function describeSettingsActionError(raw: string): DashboardSliceFailure {
  const trimmed = raw.trim();
  if (!trimmed) {
    return buildDashboardSliceFailure("settings", 400, null);
  }
  return {
    ...buildDashboardSliceFailure("settings", 400, null),
    title: "Could not save",
    message: trimmed,
    actions: [{ kind: "retry", label: DASHBOARD_CTA.tryAgain, href: "/dashboard/settings" }],
  };
}

/** Maps sessions page redirect codes from overview query params. */
export function describeSessionsOverviewError(code: string | null): DashboardSliceFailure {
  const messages: Record<string, string> = {
    forbidden: "You do not have permission to view active sessions.",
    server_error: "Could not load your active sessions. Try again from Settings.",
  };
  return {
    slice: "settings",
    code,
    status: 403,
    title: "Sessions unavailable",
    message: (code && messages[code]) ?? "Could not load your active sessions.",
    actions: [
      { kind: "navigate", label: "Open settings", href: "/dashboard/settings/sessions" },
      { kind: "retry", label: DASHBOARD_CTA.tryAgain, href: DASHBOARD_ROUTES.overview },
    ],
  };
}

/** Seller payout enum errors (existing API contract). */
export function buildSellerPayoutFailure(
  error: "unauthorized" | "forbidden" | "server_error" | string,
): DashboardSliceFailure {
  const status = error === "unauthorized" ? 401 : error === "forbidden" ? 403 : 500;
  return buildDashboardSliceFailure(
    "sellerPayouts",
    status,
    error === "server_error" ? null : error,
  );
}

/** Stripe connect enum errors (embedded Connect surfaces). */
export function buildSellerConnectFailure(
  error: "unauthorized" | "forbidden" | "server_error" | "not_connected" | string,
): DashboardSliceFailure {
  const status =
    error === "unauthorized"
      ? 401
      : error === "forbidden"
        ? 403
        : error === "not_connected"
          ? 404
          : 500;
  const failure = buildDashboardSliceFailure("sellerConnect", status, null);
  if (error === "not_connected") {
    return {
      ...failure,
      title: "Payout setup unavailable",
      message: "We could not load your payout account yet. Use the form below to get started.",
    };
  }
  if (error === "forbidden") {
    return {
      ...failure,
      title: "Cannot manage payout setup",
      message: "You may need an organisation owner or admin to complete payout verification.",
    };
  }
  return failure;
}

export { supportMailto };
