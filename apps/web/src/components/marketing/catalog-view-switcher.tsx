"use client";

import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import { useViewQueryNavigation } from "@/lib/hooks/use-view-query-navigation";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { type SegmentOption, SegmentedControl } from "@auction/ui/lax";
import { LayoutGrid, Rows3, Square } from "lucide-react";

const ALL_MODES: readonly SegmentOption<CatalogLayoutView>[] = [
  { value: "grid", label: "Grid", icon: <LayoutGrid aria-hidden />, iconOnly: true },
  { value: "card", label: "Card", icon: <Square aria-hidden />, iconOnly: true },
  { value: "list", label: "List", icon: <Rows3 aria-hidden />, iconOnly: true },
];

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
  const options = supportedModes
    ? ALL_MODES.filter((mode) => supportedModes.includes(mode.value))
    : ALL_MODES;

  return (
    <SegmentedControl
      label="View"
      value={liveView}
      onValueChange={navigate}
      options={options}
      disabled={pending}
    />
  );
}
