import { cn } from "@auction/ui";
import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLHeadingElement> & {
  children: ReactNode;
};

/** Shared H3 scale for marketing cards and journey sections. */
export function MarketingSectionSubheading({ children, className, ...props }: Props) {
  return (
    <h3 className={cn("font-headline text-lg leading-snug text-on-surface", className)} {...props}>
      {children}
    </h3>
  );
}
