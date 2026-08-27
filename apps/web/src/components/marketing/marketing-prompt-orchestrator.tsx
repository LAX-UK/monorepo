"use client";

import { useAppSession } from "@/lib/auth/use-app-session";
import {
  type MarketingPromptAnalytics,
  defaultMarketingPromptAnalytics,
} from "@/lib/marketing/prompts/analytics";
import {
  readMarketingPromptSuppression,
  writeMarketingPromptSuppression,
} from "@/lib/marketing/prompts/persistence";
import { resolveMarketingPrompt } from "@/lib/marketing/prompts/policy";
import type {
  MarketingPromptDecision,
  MarketingPromptVariant,
} from "@/lib/marketing/prompts/types";
import { useMarketingPromptDwell } from "@/lib/marketing/prompts/use-marketing-prompt-dwell";
import { useMarketingPromptSession } from "@/lib/marketing/prompts/use-marketing-prompt-session";
import { useEffect, useState } from "react";
import { MarketingPromptDialog } from "./marketing-prompt-dialog";

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

export function MarketingPromptOrchestrator({
  enabled,
  analytics = defaultMarketingPromptAnalytics,
}: {
  enabled: boolean;
  analytics?: MarketingPromptAnalytics;
}) {
  const { user, pending } = useAppSession();
  const { pathname, session, storageReady, hasNavigated, updateSession } =
    useMarketingPromptSession();
  const [activePrompt, setActivePrompt] = useState<MarketingPromptDecision | null>(null);

  useMarketingPromptDwell({ enabled, storageReady, updateSession });

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
    analytics.onImpression(decision, pathname);
  }, [
    activePrompt,
    analytics,
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
    analytics.onDismiss(activePrompt, pathname);
    setActivePrompt(null);
  };

  const selectCta = () => {
    suppress(activePrompt.variant, "cta");
    analytics.onCta(activePrompt, pathname);
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
