import { cn } from "@auction/ui";
import type { DotStatusPillTone } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import type { KeyboardEvent, ReactNode } from "react";

export type DetailCardGridImageAspect = "4/3" | "video";

function detailCardGridImageAspectClass(aspect: DetailCardGridImageAspect = "4/3"): string {
  return aspect === "video" ? "aspect-video" : "aspect-[4/3]";
}

export type DetailCardGridItem = {
  id: string;
  image?: ReactNode;
  imageAspect?: DetailCardGridImageAspect;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: { label: string; tone?: DotStatusPillTone };
  meta?: ReactNode;
  href?: string;
  onClick?: () => void;
};

export type DetailCardGridProps = {
  items: readonly DetailCardGridItem[];
  emptyTitle?: string;
  columns?: 2 | 3 | 4;
  className?: string;
};

/** Responsive card grid for media, press, and image galleries. */
export function DetailCardGrid({
  items,
  emptyTitle = "No items yet",
  columns = 3,
  className,
}: DetailCardGridProps) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-outline-variant/40 p-6 text-center font-body text-sm text-on-surface-variant">
        {emptyTitle}
      </p>
    );
  }

  const colClass =
    columns === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === 2
        ? "sm:grid-cols-2"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={cn("grid gap-4", colClass, className)}>
      {items.map((item) => {
        const inner = (
          <>
            {item.image ? (
              <div
                className={cn(
                  detailCardGridImageAspectClass(item.imageAspect),
                  "overflow-hidden rounded-md bg-surface-container-high [&_img]:size-full [&_img]:object-cover",
                )}
              >
                {item.image}
              </div>
            ) : (
              <div
                className={cn(
                  detailCardGridImageAspectClass(item.imageAspect),
                  "rounded-md bg-surface-container-high",
                )}
              />
            )}
            <div className="mt-3 space-y-1">
              <p className="line-clamp-2 font-headline text-sm font-semibold leading-snug text-on-surface">
                {item.title}
              </p>
              {item.subtitle ? (
                <p className="line-clamp-2 font-body text-xs leading-relaxed text-on-surface-variant">
                  {item.subtitle}
                </p>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-shell-stroke/60 pt-3">
              {item.badge ? (
                <DotStatusPill label={item.badge.label} tone={item.badge.tone ?? "info"} />
              ) : (
                <span />
              )}
              {item.meta ? (
                <span className="font-label text-xs text-on-surface-variant">{item.meta}</span>
              ) : null}
            </div>
          </>
        );

        const cardClass =
          "block overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest p-4 shadow-[var(--shadow-rest)] transition-colors hover:border-primary/30";

        if (item.href) {
          return (
            <a key={item.id} href={item.href} className={cardClass}>
              {inner}
            </a>
          );
        }

        return (
          <div
            key={item.id}
            className={cn(
              cardClass,
              item.onClick &&
                "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )}
            {...(item.onClick
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  onClick: item.onClick,
                  onKeyDown: (e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      item.onClick?.();
                    }
                  },
                }
              : {})}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
