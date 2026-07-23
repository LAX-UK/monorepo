"use client";

import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ReactNode,
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type CatalogPostCreateSessionContextValue = {
  isPostCreateBannerActive: (readiness: CatalogReadinessResult | null | undefined) => boolean;
  registerBannerDismiss: () => void;
};

const CatalogPostCreateSessionContext = createContext<CatalogPostCreateSessionContextValue | null>(
  null,
);

const noopContext: CatalogPostCreateSessionContextValue = {
  isPostCreateBannerActive: () => false,
  registerBannerDismiss: () => {},
};

function CreatedUrlLatch({ onFreshCreate }: { onFreshCreate: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isFreshInUrl = searchParams.get("created") === "1";

  useEffect(() => {
    if (!isFreshInUrl) return;
    onFreshCreate();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");
    const qs = params.toString();
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, {
      scroll: false,
    });
  }, [isFreshInUrl, onFreshCreate, router, searchParams]);

  return null;
}

export function CatalogPostCreateSessionProvider({ children }: { children: ReactNode }) {
  const [latched, setLatched] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const onFreshCreate = useCallback(() => {
    setLatched(true);
  }, []);

  const registerBannerDismiss = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  const isPostCreateBannerActive = useCallback(
    (readiness: CatalogReadinessResult | null | undefined) =>
      latched && !bannerDismissed && !!readiness && readiness.percent < 100,
    [latched, bannerDismissed],
  );

  const value = useMemo(
    () => ({ isPostCreateBannerActive, registerBannerDismiss }),
    [isPostCreateBannerActive, registerBannerDismiss],
  );

  return (
    <CatalogPostCreateSessionContext.Provider value={value}>
      <Suspense fallback={null}>
        <CreatedUrlLatch onFreshCreate={onFreshCreate} />
      </Suspense>
      {children}
    </CatalogPostCreateSessionContext.Provider>
  );
}

export function CatalogPostCreateSessionRoot({ children }: { children: ReactNode }) {
  return <CatalogPostCreateSessionProvider>{children}</CatalogPostCreateSessionProvider>;
}

export function useCatalogPostCreateSession(): CatalogPostCreateSessionContextValue {
  return useContext(CatalogPostCreateSessionContext) ?? noopContext;
}
