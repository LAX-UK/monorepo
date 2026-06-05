"use client";

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
  value: CatalogLayoutView;
  supportedModes?: readonly CatalogLayoutView[];
  /** URL-canonical default; param omitted from query string when active. */
  defaultView?: CatalogLayoutView;
}) {
  const { navigate, pending } = useViewQueryNavigation({ routeKey, defaultView });

  return (
    <ViewSwitcher
      value={value}
      onValueChange={navigate}
      {...(supportedModes !== undefined ? { modes: supportedModes } : {})}
      disabled={pending}
    />
  );
}
