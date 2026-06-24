"use client";

import { ConnectivityBannerShell } from "@/components/realtime/connectivity-banner-shell";
import type { SocketCopyScope } from "@/lib/connection/live-connectivity-copy";
import { noticeScopeForId } from "@/lib/connection/live-connectivity-copy";
import { useLiveConnectivityNoticesOptional } from "@/lib/connection/live-connectivity-notice";
import { useBrowserOnline } from "@/lib/connection/use-browser-online";

type Props = {
  scope: SocketCopyScope;
  testId: string;
};

/** Fixed-top banner for scoped hydrate-failure notices (staff surfaces without socket health port). */
export function LiveConnectivityNoticeBanner({ scope, testId }: Props) {
  const browserOnline = useBrowserOnline();
  const notices = useLiveConnectivityNoticesOptional();
  const notice = notices.find((n) => noticeScopeForId(n.id) === scope) ?? null;

  if (!browserOnline || !notice) return null;

  return (
    <ConnectivityBannerShell
      variant="fixed-top"
      tone="warning"
      testId={testId}
      message={notice.message}
    />
  );
}
