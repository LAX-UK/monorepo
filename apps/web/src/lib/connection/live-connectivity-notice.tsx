"use client";

import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

export type LiveConnectivityNotice = {
  id: string;
  message: string;
};

type ReporterValue = {
  reportNotice: (notice: LiveConnectivityNotice) => void;
  clearNotice: (id: string) => void;
};

type ContextValue = ReporterValue & {
  activeNotices: readonly LiveConnectivityNotice[];
};

const LiveConnectivityNoticeContext = createContext<ContextValue | null>(null);

/** Tracks persistent hydrate-failure notices for live connectivity banners. */
export function LiveConnectivityNoticeProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<LiveConnectivityNotice[]>([]);

  const reportNotice = useCallback((notice: LiveConnectivityNotice) => {
    setNotices((prev) => {
      const idx = prev.findIndex((n) => n.id === notice.id);
      if (idx === -1) return [...prev, notice];
      const next = [...prev];
      next[idx] = notice;
      return next;
    });
  }, []);

  const clearNotice = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const value = useMemo<ContextValue>(
    () => ({
      reportNotice,
      clearNotice,
      activeNotices: notices,
    }),
    [reportNotice, clearNotice, notices],
  );

  return (
    <LiveConnectivityNoticeContext.Provider value={value}>
      {children}
    </LiveConnectivityNoticeContext.Provider>
  );
}

export function useLiveConnectivityNotices(): readonly LiveConnectivityNotice[] {
  const ctx = useContext(LiveConnectivityNoticeContext);
  if (!ctx) {
    throw new Error(
      "useLiveConnectivityNotices must be used within LiveConnectivityNoticeProvider",
    );
  }
  return ctx.activeNotices;
}

/** Minimal reporter API for data providers (ISP). */
export function useLiveConnectivityNoticeReporter(): ReporterValue {
  const ctx = useContext(LiveConnectivityNoticeContext);
  if (!ctx) {
    throw new Error(
      "useLiveConnectivityNoticeReporter must be used within LiveConnectivityNoticeProvider",
    );
  }
  return { reportNotice: ctx.reportNotice, clearNotice: ctx.clearNotice };
}

/** Optional reporter for providers that may render outside the notice tree in tests. */
export function useLiveConnectivityNoticeReporterOptional(): ReporterValue | null {
  const ctx = useContext(LiveConnectivityNoticeContext);
  if (!ctx) return null;
  return { reportNotice: ctx.reportNotice, clearNotice: ctx.clearNotice };
}

/** Optional accessor when provider may be absent (e.g. unit tests). */
export function useLiveConnectivityNoticesOptional(): readonly LiveConnectivityNotice[] {
  const ctx = useContext(LiveConnectivityNoticeContext);
  return ctx?.activeNotices ?? [];
}
