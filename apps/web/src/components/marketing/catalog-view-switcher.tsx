"use client";

import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import { useViewQueryNavigation } from "@/lib/hooks/use-view-query-navigation";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { ViewSwitcher } from "@auction/ui";

export function CatalogViewSwitcher({
  routeKey,
  value,
  supportedModes,
  defaultView = "grid",
}: {
  routeKey: string;
  /** SSR seed; live value comes from the URL without an RSC round-trip. */
  value: CatalogLayoutView;
  supportedModes?: readonly CatalogLayoutView[];
  /** URL-canonical default; param omitted from query string when active. */
  defaultView?: CatalogLayoutView;
}) {
  const liveView = useUrlLayoutView(defaultView, value) as CatalogLayoutView;
  const { navigate, pending } = useViewQueryNavigation({ routeKey, defaultView });

  return (
    <ViewSwitcher
      value={liveView}
      onValueChange={navigate}
      {...(supportedModes !== undefined ? { modes: supportedModes } : {})}
      disabled={pending}
    />
  );
}
