import { cn } from "@auction/ui";
import type { ComponentProps } from "react";

/** Org tab section header — hidden on mobile when shell title already shows the tab name. */
export function OrgTabSectionHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("hidden lg:block", className)} {...props} />;
}
