"use client";

import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import { useViewQueryNavigation } from "@/lib/hooks/use-view-query-navigation";
import { salesBrowseViewCookieValue } from "@/lib/preferences/view-query-navigation";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { CalendarDays, LayoutGrid, Rows3 } from "lucide-react";

export type SalesBrowseView = "grid" | "list" | "calendar";

const MODES: ReadonlyArray<{ value: SalesBrowseView; label: string; Icon: typeof LayoutGrid }> = [
  { value: "grid", label: "Grid", Icon: LayoutGrid },
  { value: "list", label: "List", Icon: Rows3 },
  { value: "calendar", label: "Calendar", Icon: CalendarDays },
];

/** Sales calendar view toggle (grid / list / agenda-by-month). Uses the same URL + scroll
 * navigation as `CatalogViewSwitcher`; adds `calendar` mode and sales-specific cookie mapping. */
export function SalesViewSwitcher({
  value,
  defaultView = "grid",
}: {
  value: SalesBrowseView;
  defaultView?: SalesBrowseView;
}) {
  const liveView = useUrlLayoutView(defaultView, value) as SalesBrowseView;
  const { navigate, pending } = useViewQueryNavigation({
    routeKey: "sales",
    defaultView,
    toCookieValue: salesBrowseViewCookieValue,
  });

  return (
    <div className="inline-flex items-center gap-1">
      <span className="sr-only" aria-live="polite">
        {liveView === "calendar"
          ? "Calendar view"
          : liveView === "list"
            ? "List view"
            : "Grid view"}
      </span>
      <div
        role="radiogroup"
        aria-label="View"
        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-outline-variant/40 bg-surface-container-low p-1"
      >
        {MODES.map(({ value: m, label, Icon }) => {
          const selected = liveView === m;
          return (
            <Button
              key={m}
              type="button"
              variant="ghost"
              size="icon"
              // biome-ignore lint/a11y/useSemanticElements: icon toggle uses button radios to match the shared ViewSwitcher
              role="radio"
              aria-checked={selected}
              disabled={pending}
              onClick={() => navigate(m)}
              title={label}
              className={cn(
                "size-9 rounded-full md:size-8",
                selected
                  ? "bg-primary text-on-primary hover:bg-primary hover:text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">{label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
