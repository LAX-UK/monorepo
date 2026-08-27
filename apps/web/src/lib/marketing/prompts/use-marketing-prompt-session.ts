"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_MARKETING_PROMPT_SESSION,
  readMarketingPromptSession,
  writeMarketingPromptSession,
} from "./persistence";
import { isMarketingPromptRoute } from "./route-eligibility";
import { resolveSellingIntentTrigger } from "./selling-intent";
import type { MarketingPromptSession } from "./types";

function readSessionSafely(): MarketingPromptSession {
  try {
    return readMarketingPromptSession(window.sessionStorage);
  } catch {
    return { ...EMPTY_MARKETING_PROMPT_SESSION };
  }
}

function persistSessionSafely(session: MarketingPromptSession): void {
  try {
    writeMarketingPromptSession(window.sessionStorage, session);
  } catch {
    // Keep the in-memory session when storage access itself is unavailable.
  }
}

export function useMarketingPromptSession() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = useMemo(() => (search ? `${pathname}?${search}` : pathname), [pathname, search]);
  const [session, setSession] = useState<MarketingPromptSession>({
    ...EMPTY_MARKETING_PROMPT_SESSION,
  });
  const [storageReady, setStorageReady] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const initialRouteRef = useRef<string | null>(null);

  const updateSession = useCallback(
    (updater: (current: MarketingPromptSession) => MarketingPromptSession) => {
      setSession((current) => {
        const next = updater(current);
        persistSessionSafely(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    setSession(readSessionSafely());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    const isInitialRoute = initialRouteRef.current == null;
    if (isInitialRoute) {
      initialRouteRef.current = routeKey;
    } else if (initialRouteRef.current !== routeKey) {
      setHasNavigated(true);
    }

    const intentTrigger = resolveSellingIntentTrigger({ pathname, search });
    updateSession((current) => {
      const eligible = isMarketingPromptRoute(pathname);
      const isNewEligibleRoute = eligible && current.lastEligiblePath !== routeKey;
      return {
        ...current,
        eligiblePageViews: current.eligiblePageViews + (isNewEligibleRoute ? 1 : 0),
        lastEligiblePath: isNewEligibleRoute ? routeKey : current.lastEligiblePath,
        sellingIntentTrigger: intentTrigger ?? current.sellingIntentTrigger,
      };
    });
  }, [pathname, routeKey, search, storageReady, updateSession]);

  return { pathname, session, storageReady, hasNavigated, updateSession };
}
