import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type SplitDetailLayoutProps = {
  mediaSlot: ReactNode;
  metaSlot: ReactNode;
  secondarySlot?: ReactNode;
  className?: string;
};

/** Gallery split: media-left, sticky meta-right; stacks below lg. */
export function SplitDetailLayout({
  mediaSlot,
  metaSlot,
  secondarySlot,
  className,
}: SplitDetailLayoutProps) {
  return (
    <div className={cn("space-y-8", className)}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:items-start lg:gap-10">
        <div className="min-w-0">{mediaSlot}</div>
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--header-height-shell,52px)+1rem)] lg:self-start">
          {metaSlot}
        </aside>
      </div>
      {secondarySlot}
    </div>
  );
}
