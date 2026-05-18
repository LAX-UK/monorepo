import { cn } from "@auction/ui";
import type { HTMLAttributes } from "react";

export function TableScroll({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "-mx-1 max-w-full overflow-x-auto rounded-lg border border-border-hairline shadow-[inset_-12px_0_12px_-12px_rgba(0,0,0,0.06)] md:mx-0 md:shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
