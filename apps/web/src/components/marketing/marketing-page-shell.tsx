import { MARKETING_PAGE_INNER, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import type { HTMLAttributes, ReactNode } from "react";

export type MarketingPageShellProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "div" | "main" | "section";
  variant?: "full" | "inner";
};

export function MarketingPageShell({
  children,
  className,
  as: Tag = "div",
  variant = "full",
  ...rest
}: MarketingPageShellProps) {
  return (
    <Tag
      className={cn(variant === "inner" ? MARKETING_PAGE_INNER : MARKETING_PAGE_SHELL, className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
