import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type MarketingCardMediaProps = {
  className?: string;
  children: ReactNode;
};

export function MarketingCardMedia({ className, children }: MarketingCardMediaProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "[&_img]:motion-safe:transition-transform [&_img]:motion-safe:duration-700 [&_img]:motion-safe:ease-out",
        "motion-safe:group-hover:[&_img]:scale-[1.02] motion-reduce:group-hover:[&_img]:scale-100",
        className,
      )}
    >
      {children}
    </div>
  );
}
