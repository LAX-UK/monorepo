"use client";

import { useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from "react";

type SearchCatalogPendingContextValue = {
  pending: boolean;
  navigate: (href: string) => void;
};

const SearchCatalogPendingContext = createContext<SearchCatalogPendingContextValue | null>(null);

function useSearchCatalogPending(): SearchCatalogPendingContextValue {
  const ctx = useContext(SearchCatalogPendingContext);
  if (!ctx) {
    throw new Error("useSearchCatalogPending must be used within SearchCatalogPendingProvider");
  }
  return ctx;
}

export function SearchCatalogPendingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );

  const value = useMemo(() => ({ pending, navigate }), [pending, navigate]);

  return (
    <SearchCatalogPendingContext.Provider value={value}>
      {children}
    </SearchCatalogPendingContext.Provider>
  );
}

export function SearchResultsShell({ children }: { children: ReactNode }) {
  const { pending } = useSearchCatalogPending();
  return (
    <section aria-busy={pending || undefined} aria-live={pending ? "polite" : undefined}>
      {children}
    </section>
  );
}

export { useSearchCatalogPending };
