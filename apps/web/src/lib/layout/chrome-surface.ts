import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

/** Visual chrome context for shared header icon controls. */
export type ChromeSurface = "marketing" | "shell";

export const shellChromeIconClassName =
  "text-secondary hover:bg-surface-container-low hover:text-link";

export function chromeIconButtonClassName(surface: ChromeSurface, extra?: string): string {
  return cn(
    "min-h-[44px] min-w-[44px]",
    FOCUS_RING,
    surface === "shell" ? shellChromeIconClassName : "",
    extra,
  );
}
