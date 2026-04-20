import * as React from "react";
import { cn } from "../../lib/utils.js";

/**
 * Main content column beside a fixed sidebar (naming aligned with shadcn SidebarInset).
 */
export function SidebarInset({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-h-screen flex-1 flex-col", className)} {...props} />;
}

export const SidebarTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cn(
      "inline-flex h-9 w-9 items-center justify-center rounded-md text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      className,
    )}
    {...props}
  />
));
SidebarTrigger.displayName = "SidebarTrigger";
