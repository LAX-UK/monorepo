import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type HomeSectionToolbarProps = {
  countLabel: string;
  trailing?: ReactNode;
  filters?: ReactNode;
  /** On mobile, move trailing controls to a second row below count + filters. */
  stackControlsOnMobile?: boolean;
  className?: string;
};

const countClassName =
  "max-w-[6rem] shrink-0 truncate font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant tabular-nums sm:max-w-[10rem]";

/** Static inset toolbar for home catalogue sections (non-sticky). */
export function HomeSectionToolbar({
  countLabel,
  trailing,
  filters,
  stackControlsOnMobile = false,
  className,
}: HomeSectionToolbarProps) {
  const stackMobile = stackControlsOnMobile && Boolean(filters && trailing);

  return (
    <div
      className={cn(
        "rounded-lg border border-border-hairline bg-white/80 px-4 py-2 dark:bg-surface-container-low/40 md:px-5 md:py-3",
        className,
      )}
    >
      <div className="flex flex-col gap-2 md:gap-0">
        <div className="flex min-h-12 min-w-0 items-center gap-2 md:min-h-14 md:gap-3">
          <p className={countClassName}>{countLabel}</p>
          {filters ? <div className="flex min-w-0 flex-1 items-center">{filters}</div> : null}
          {trailing ? (
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 md:gap-3",
                countLabel || filters ? "ml-auto" : "",
                stackMobile && "hidden md:flex",
              )}
            >
              {trailing}
            </div>
          ) : null}
        </div>
        {stackMobile ? (
          <div
            data-testid="home-toolbar-mobile-trailing-row"
            className="flex items-center justify-end gap-2 border-t border-border-hairline pt-2 md:hidden"
          >
            {trailing}
          </div>
        ) : null}
      </div>
    </div>
  );
}
