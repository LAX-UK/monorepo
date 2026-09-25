import "server-only";

import { redirectIfAuthenticated } from "@/lib/auth/guards.server";
import { redirect } from "next/navigation";
import { resolveHostedAuthEntry } from "./auth-entry-intent.server";
import {
  buildBidHostedRecoveryUrl,
  buildBidOidcLoginStartUrl,
} from "./redirect-to-hosted-auth.server";

type AuthRoute = "login" | "register" | "forgot-password" | "reset-password";

export async function ensureHostedAuthRedirect(options: {
  route: AuthRoute;
  searchParams: URLSearchParams;
  authenticatedBypass?: boolean;
}): Promise<void> {
  if (options.authenticatedBypass !== false) {
    const guardRoute = options.route === "reset-password" ? "login" : options.route;
    await redirectIfAuthenticated({ route: guardRoute });
  }
  let entry = resolveHostedAuthEntry(options.searchParams);
  if (options.route === "register" && entry.funnel !== "sell") {
    entry = { ...entry, screen: "signup" };
  }
  if (options.route === "login" && options.searchParams.get("error")) {
    return;
  }
  if (options.route === "forgot-password") {
    redirect(buildBidHostedRecoveryUrl("/forgot-password"));
  }
  if (options.route === "reset-password") {
    const token = options.searchParams.get("token") ?? undefined;
    redirect(buildBidHostedRecoveryUrl("/reset-password", token));
  }
  redirect(buildBidOidcLoginStartUrl(entry));
}
