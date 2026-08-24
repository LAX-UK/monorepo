"use client";

import { trackMarketingPrompt } from "@/lib/analytics/events";
import { trackSellCtaClick } from "@/lib/analytics/sell-funnel";
import { useAppSession } from "@/lib/auth/use-app-session";
import {
  EMPTY_MARKETING_PROMPT_SESSION,
  readMarketingPromptSession,
  readMarketingPromptSuppression,
  writeMarketingPromptSession,
  writeMarketingPromptSuppression,
} from "@/lib/marketing/prompts/persistence";
import {
  isMarketingPromptRoute,
  resolveMarketingPrompt,
  resolveSellingIntentTrigger,
} from "@/lib/marketing/prompts/policy";
import type {
  MarketingPromptDecision,
  MarketingPromptSession,
  MarketingPromptVariant,
} from "@/lib/marketing/prompts/types";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketingPromptDialog } from "./marketing-prompt-dialog";

export const MARKETING_PROMPT_DWELL_TICK_MS = 1_000;

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

function isSuppressed(variant: MarketingPromptVariant): boolean {
  try {
    return Boolean(readMarketingPromptSuppression(window.localStorage, variant));
  } catch {
    return false;
  }
}

function suppress(variant: MarketingPromptVariant, reason: "dismissed" | "cta"): void {
  try {
    writeMarketingPromptSuppression(window.localStorage, variant, reason);
  } catch {
    // The session cap still prevents another prompt during this visit.
  }
}

function hasCompetingDialog(): boolean {
  return document.querySelector('[role="dialog"][data-state="open"]') != null;
}

export function MarketingPromptOrchestrator({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const routeKey = useMemo(() => (search ? `${pathname}?${search}` : pathname), [pathname, search]);
  const { user, pending } = useAppSession();
  const [session, setSession] = useState<MarketingPromptSession>({
    ...EMPTY_MARKETING_PROMPT_SESSION,
  });
  const [storageReady, setStorageReady] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [activePrompt, setActivePrompt] = useState<MarketingPromptDecision | null>(null);
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

  useEffect(() => {
    if (!storageReady || !enabled) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      updateSession((current) => ({
        ...current,
        activeDwellMs: current.activeDwellMs + MARKETING_PROMPT_DWELL_TICK_MS,
      }));
    }, MARKETING_PROMPT_DWELL_TICK_MS);
    return () => window.clearInterval(interval);
  }, [enabled, storageReady, updateSession]);

  useEffect(() => {
    if (!storageReady || !hasNavigated || activePrompt) return;

    const decision = resolveMarketingPrompt({
      enabled,
      authState: pending ? "pending" : user ? "authenticated" : "guest",
      pathname,
      activeDwellMs: session.activeDwellMs,
      eligiblePageViews: session.eligiblePageViews,
      sellingIntentTrigger: session.sellingIntentTrigger,
      sessionPromptShown: session.shownVariant != null,
      sellingSuppressed: isSuppressed("selling"),
      signupSuppressed: isSuppressed("signup"),
      competingDialogOpen: hasCompetingDialog(),
    });
    if (!decision) return;

    updateSession((current) => ({ ...current, shownVariant: decision.variant }));
    setActivePrompt(decision);
    trackMarketingPrompt({
      action: "impression",
      variant: decision.variant,
      trigger: decision.trigger,
      path: pathname,
    });
  }, [
    activePrompt,
    enabled,
    hasNavigated,
    pathname,
    pending,
    session,
    storageReady,
    updateSession,
    user,
  ]);

  if (!activePrompt) return null;

  const dismiss = () => {
    suppress(activePrompt.variant, "dismissed");
    trackMarketingPrompt({
      action: "dismissal",
      variant: activePrompt.variant,
      trigger: activePrompt.trigger,
      path: pathname,
    });
    setActivePrompt(null);
  };

  const selectCta = () => {
    suppress(activePrompt.variant, "cta");
    trackMarketingPrompt({
      action: "cta",
      variant: activePrompt.variant,
      trigger: activePrompt.trigger,
      path: pathname,
    });
    if (activePrompt.variant === "selling") {
      trackSellCtaClick("contextual_marketing_prompt");
    }
    setActivePrompt(null);
  };

  return (
    <MarketingPromptDialog
      open
      variant={activePrompt.variant}
      isAuthenticated={Boolean(user)}
      onDismiss={dismiss}
      onCta={selectCta}
    />
  );
}
