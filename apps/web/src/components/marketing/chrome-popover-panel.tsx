import { cn } from "@auction/ui";
import { type HTMLAttributes, type ReactNode, forwardRef } from "react";

export type ChromePopoverPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/** Shared absolute dropdown shell for account menu and notifications. */
export const ChromePopoverPanel = forwardRef<HTMLDivElement, ChromePopoverPanelProps>(
  function ChromePopoverPanel({ children, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "absolute right-0 top-full z-50 mt-2 rounded-lg border border-nav-border bg-surface py-2 shadow-sm motion-reduce:shadow-none dark:border-outline-variant/20",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
