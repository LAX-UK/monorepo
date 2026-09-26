import "server-only";

import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import type { OidcAuthorizePrompt } from "@auction/identity-rp";

/** Stored on the pending BFF session for analytics / post-login handoff. */
export type StoredAuthEntryIntent = "signup" | "reauth" | "sell" | "silent";

export type HostedAuthEntry = {
  screen: "login" | "signup";
  funnel: "sell" | null;
  reauth: boolean;
  nextPath: string;
  inviteToken?: string;
  forceLoginPrompt: boolean;
};

export type AuthorizePromptParams = {
  prompt?: OidcAuthorizePrompt;
};

export function resolveHostedAuthEntry(searchParams: URLSearchParams): HostedAuthEntry {
  const requestedNext = searchParams.get("next");
  const nextPath = requestedNext && isSafeNextPath(requestedNext) ? requestedNext : "/dashboard";
  const rawIntent = searchParams.get("intent")?.trim();
  const reauth = rawIntent === "reauth";
  const funnel: HostedAuthEntry["funnel"] = rawIntent === "sell" ? "sell" : null;
  const screen: HostedAuthEntry["screen"] =
    rawIntent === "signup" || rawIntent === "register" || funnel === "sell" ? "signup" : "login";
  const inviteRaw = searchParams.get("invite")?.trim();
  const inviteToken = inviteRaw && inviteRaw.length >= 16 ? inviteRaw : undefined;
  const forceLoginPrompt = searchParams.get("switch") === "1" || reauth;
  return {
    screen,
    funnel,
    reauth,
    nextPath,
    forceLoginPrompt,
    ...(inviteToken ? { inviteToken } : {}),
  };
}

export function authorizeParamsForEntry(entry: HostedAuthEntry): AuthorizePromptParams {
  if (entry.reauth || entry.forceLoginPrompt) {
    return { prompt: "login" };
  }
  if (entry.screen === "signup") {
    return { prompt: "create" };
  }
  return {};
}

export function pendingIntentForStorage(entry: HostedAuthEntry): StoredAuthEntryIntent | undefined {
  if (entry.reauth) return "reauth";
  if (entry.funnel === "sell") return "sell";
  if (entry.screen === "signup") return "signup";
  return undefined;
}
