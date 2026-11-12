"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AnalyticsDebugPanel = dynamic(
  () =>
    import("@/components/analytics/analytics-debug-panel").then((mod) => ({
      default: mod.AnalyticsDebugPanel,
    })),
  { ssr: false },
);

/** The panel only exists with `?lax_analytics_debug` in the URL, so its code loads only then. */
export function AnalyticsDebugPanelLazy() {
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    setRequested(new URLSearchParams(window.location.search).has("lax_analytics_debug"));
  }, []);
  return requested ? <AnalyticsDebugPanel /> : null;
}
