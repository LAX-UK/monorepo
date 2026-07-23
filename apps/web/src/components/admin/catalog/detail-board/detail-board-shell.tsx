import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import type { ReactNode } from "react";

export type DetailBoardShellProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Count badge beside title */
  count?: number;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Figma-aligned card shell for admin detail tab boards. */
export function DetailBoardShell({
  title,
  description,
  count,
  actions,
  toolbar,
  children,
  footer,
  className,
}: DetailBoardShellProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-shell-stroke px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 space-y-1">
            <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
              {title}
            </h2>
            {description ? (
              <p className="font-body text-sm text-on-surface-variant">{description}</p>
            ) : null}
          </div>
          {count != null ? (
            <Badge
              variant="secondary"
              className="h-6 min-w-6 shrink-0 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
            >
              {count > 99 ? "99+" : count}
            </Badge>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {toolbar ? (
        <div className="border-b border-shell-stroke px-4 py-4 sm:px-6">{toolbar}</div>
      ) : null}
      <div className="p-4 sm:p-6">{children}</div>
      {footer ? (
        <div className="border-t border-shell-stroke px-4 py-4 sm:px-6">{footer}</div>
      ) : null}
    </div>
  );
}
