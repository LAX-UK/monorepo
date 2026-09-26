import type { CookieJar } from "./ports/cookie-jar.js";
import {
  type HeaderGetter,
  isDocumentNavigation,
  isLikelyCrawler,
  isPrefetch,
} from "./request-signals.js";
import {
  type SilentSignInCookieNames,
  createSilentSignInCookieSpec,
} from "./silent-sign-in-cookies.js";

export type SilentSignInRequest = {
  method: string;
  pathname: string;
  getHeader: HeaderGetter;
  userAgent: string | null | undefined;
  hasProductSession: boolean;
};

export type EvaluateSilentSignInEligibilityInput = {
  request: SilentSignInRequest;
  cookieJar: CookieJar;
  cookieNames?: SilentSignInCookieNames;
  skipPathPrefixes: string[];
  /** Skip Sec-Fetch / UA checks (e.g. server-side FedCM bootstrap props). */
  skipRequestSignals?: boolean;
};

export type EvaluateSilentSignInCookieGateInput = {
  hasProductSession: boolean;
  cookieJar: CookieJar;
  cookieNames?: SilentSignInCookieNames;
};

export type SilentSignInCookieGate = { allowed: true } | { allowed: false; reason: string };

export type SilentSignInEligibility = { kind: "probe" } | { kind: "skip"; reason: string };

function pathMatchesSkip(pathname: string, skipPathPrefixes: string[]): boolean {
  return skipPathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function evaluateCookieAndSessionGate(
  hasProductSession: boolean,
  cookieJar: CookieJar,
  cookieNames: SilentSignInCookieNames,
): SilentSignInEligibility {
  if (hasProductSession) {
    return { kind: "skip", reason: "has_product_session" };
  }
  if (cookieJar.get(cookieNames.suppressed)) {
    return { kind: "skip", reason: "suppressed" };
  }
  if (cookieJar.get(cookieNames.quiet)) {
    return { kind: "skip", reason: "quiet_period" };
  }
  if (cookieJar.get(cookieNames.probe)) {
    return { kind: "skip", reason: "probe_in_flight" };
  }
  return { kind: "probe" };
}

export function evaluateSilentSignInCookieGate(
  input: EvaluateSilentSignInCookieGateInput,
): SilentSignInCookieGate {
  const cookieNames = input.cookieNames ?? createSilentSignInCookieSpec("sso");
  const gate = evaluateCookieAndSessionGate(input.hasProductSession, input.cookieJar, cookieNames);
  if (gate.kind === "skip") {
    return { allowed: false, reason: gate.reason };
  }
  return { allowed: true };
}

export function evaluateSilentSignInEligibility(
  input: EvaluateSilentSignInEligibilityInput,
): SilentSignInEligibility {
  const { request, cookieJar, skipPathPrefixes } = input;
  const cookieNames = input.cookieNames ?? createSilentSignInCookieSpec("sso");

  if (!input.skipRequestSignals) {
    if (!isDocumentNavigation(request.method, request.getHeader)) {
      return { kind: "skip", reason: "not_document_navigation" };
    }
    if (isPrefetch(request.getHeader)) {
      return { kind: "skip", reason: "prefetch" };
    }
    if (isLikelyCrawler(request.userAgent)) {
      return { kind: "skip", reason: "crawler" };
    }
    if (pathMatchesSkip(request.pathname, skipPathPrefixes)) {
      return { kind: "skip", reason: "skip_path" };
    }
  }
  const gate = evaluateCookieAndSessionGate(request.hasProductSession, cookieJar, cookieNames);
  if (gate.kind === "skip") {
    return gate;
  }
  return { kind: "probe" };
}
