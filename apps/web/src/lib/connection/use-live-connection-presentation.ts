"use client";

import type { LiveConnectivityScope } from "@/lib/connection/live-connectivity-copy";
import { useLiveConnectivityNoticesOptional } from "@/lib/connection/live-connectivity-notice";
import { resolveLiveConnectivityBanner } from "@/lib/connection/resolve-live-connectivity-banner";
import { useLiveConnection } from "@/lib/connection/use-live-connection";
import { useMemo } from "react";

export function useLiveConnectionPresentation(scope: LiveConnectivityScope) {
  const { state: connectionState } = useLiveConnection();
  const notices = useLiveConnectivityNoticesOptional();

  return useMemo(
    () =>
      resolveLiveConnectivityBanner({
        scope,
        connectionState,
        notices,
      }),
    [scope, connectionState, notices],
  );
}
