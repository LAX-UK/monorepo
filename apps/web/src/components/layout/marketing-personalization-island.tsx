import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

export type MarketingPersonalization = {
  isAuthenticated: boolean;
  watchedLotIds: string[];
};

async function resolvePersonalization(): Promise<MarketingPersonalization> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!hasAuthSessionCookie(cookieHeader)) {
    return { isAuthenticated: false, watchedLotIds: [] };
  }
  const session = await getServerSessionUser();
  if (!session) {
    return { isAuthenticated: false, watchedLotIds: [] };
  }
  const watched = await getServerWatchedLotIdSet();
  return { isAuthenticated: true, watchedLotIds: Array.from(watched) };
}

/** Suspense island: session + watchlist for lot cards. Mega menu dashboard hrefs are restored in SiteHeader when authed. */
export async function MarketingPersonalizationIsland({
  children,
}: {
  children: (personalization: MarketingPersonalization) => ReactNode;
}) {
  const personalization = await resolvePersonalization();
  return children(personalization);
}
