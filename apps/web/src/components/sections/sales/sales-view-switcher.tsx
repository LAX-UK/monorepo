"use client";

import { VIEW_COOKIE_MAX_AGE_SEC, viewCookieName } from "@/lib/preferences/view-cookie";
import { cn } from "@auction/ui";
import { CalendarDays, LayoutGrid, Rows3 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export type SalesBrowseView = "grid" | "list" | "calendar";

const MODES: ReadonlyArray<{ value: SalesBrowseView; label: string; Icon: typeof LayoutGrid }> = [
  { value: "grid", label: "Grid", Icon: LayoutGrid },
  { value: "list", label: "List", Icon: Rows3 },
  { value: "calendar", label: "Calendar", Icon: CalendarDays },
];

/** Sales calendar view toggle (grid / list / agenda-by-month). Mirrors `CatalogViewSwitcher`
 * but adds a `calendar` mode that the shared `CatalogLayoutView` type does not carry. */
export function SalesViewSwitcher({ value }: { value: SalesBrowseView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = useCallback(
    (next: SalesBrowseView) => {
      startTransition(() => {
        const nextParams = new URLSearchParams(searchParams.toString());
        if (next === "grid") nextParams.delete("view");
        else nextParams.set("view", next);
        nextParams.delete("page");
        nextParams.delete("offset");
        const secure = typeof window !== "undefined" && window.location.protocol === "https:";
        document.cookie = `${viewCookieName("sales")}=${next === "calendar" ? "grid" : next}; path=/; max-age=${VIEW_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure ? "; Secure" : ""}`;
        const qs = nextParams.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="inline-flex items-center gap-1">
      <span className="sr-only" aria-live="polite">
        {value === "calendar" ? "Calendar view" : value === "list" ? "List view" : "Grid view"}
      </span>
      <div
        role="radiogroup"
        aria-label="View"
        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-outline-variant/40 bg-surface-container-low p-1"
      >
        {MODES.map(({ value: m, label, Icon }) => {
          const selected = value === m;
          return (
            <button
              key={m}
              type="button"
              // biome-ignore lint/a11y/useSemanticElements: icon toggle uses button radios to match the shared ViewSwitcher
              role="radio"
              aria-checked={selected}
              disabled={pending}
              onClick={() => apply(m)}
              title={label}
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 md:size-8",
                selected
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
