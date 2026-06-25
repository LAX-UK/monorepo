"use client";

import { setConsentAction } from "@/lib/analytics/consent/actions";
import type { ConsentSnapshot } from "@/lib/analytics/consent/cookie";
import { isAnalyticsEnabled } from "@/lib/analytics/is-enabled";
import type { TrackPayload } from "@/lib/analytics/provider";
import { getAnalyticsProviders } from "@/lib/analytics/registry";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ConsentContextValue = {
  /** Persisted choice from cookie; `null` means visitor has not chosen yet. */
  snapshot: ConsentSnapshot | null;
  /** First-visit banner until Accept / Customise save (reject via preferences dialog). */
  showBanner: boolean;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  saveCustom: (prefs: { analytics: boolean; marketing: boolean }) => Promise<void>;
  dismissBanner: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

function syncProvidersConsent(snapshot: ConsentSnapshot | null): void {
  for (const p of getAnalyticsProviders()) {
    p.updateConsent(snapshot);
  }
}

type ConsentProviderProps = {
  children: ReactNode;
  initialSnapshot: ConsentSnapshot | null;
};

export function ConsentProvider({ children, initialSnapshot }: ConsentProviderProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ConsentSnapshot | null>(initialSnapshot);
  const [showBanner, setShowBanner] = useState(initialSnapshot === null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  // Consent Mode default + SSR cookie restore run synchronously in <head> via ConsentInit.
  useEffect(() => {
    syncProvidersConsent(snapshot);
  }, [snapshot]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  const persist = useCallback(
    async (prefs: { analytics: boolean; marketing: boolean }) => {
      const coerced = {
        analytics: prefs.analytics || prefs.marketing,
        marketing: prefs.marketing,
      };
      const res = await setConsentAction(coerced);
      if (!res.ok) return;
      setSnapshot(res.snapshot);
      setShowBanner(false);
      setPreferencesOpen(false);
      syncProvidersConsent(res.snapshot);
      router.refresh();
    },
    [router],
  );

  const acceptAll = useCallback(async () => {
    await persist({ analytics: true, marketing: true });
  }, [persist]);

  const rejectAll = useCallback(async () => {
    await persist({ analytics: false, marketing: false });
  }, [persist]);

  const saveCustom = useCallback(
    async (prefs: { analytics: boolean; marketing: boolean }) => {
      await persist(prefs);
    },
    [persist],
  );

  const value = useMemo<ConsentContextValue>(
    () => ({
      snapshot,
      showBanner,
      preferencesOpen,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
      acceptAll,
      rejectAll,
      saveCustom,
      dismissBanner,
    }),
    [snapshot, showBanner, preferencesOpen, acceptAll, rejectAll, saveCustom, dismissBanner],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within ConsentProvider");
  }
  return ctx;
}

export function useAnalytics() {
  const { snapshot } = useConsent();
  const track = useCallback(
    (payload: TrackPayload) => {
      if (!isAnalyticsEnabled()) return;
      if (!snapshot?.analytics) return;
      for (const p of getAnalyticsProviders()) {
        p.track(payload);
      }
    },
    [snapshot],
  );
  return { track, consent: snapshot };
}
