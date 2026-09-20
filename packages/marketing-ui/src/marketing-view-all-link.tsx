import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import { MarketingViewAllChevron } from "./marketing-icons.js";

type SharedProps = {
  className?: string;
} & Omit<ComponentPropsWithoutRef<"a">, "children" | "className">;

type MarketingViewAllLinkProps =
  | (SharedProps & {
      asChild: true;
      children: ReactElement;
      srSuffix?: never;
    })
  | (SharedProps & {
      asChild?: false;
      children?: ReactNode;
      /** Screen-reader context appended after the visible label. */
      srSuffix?: string;
    });

export function MarketingViewAllLink(props: MarketingViewAllLinkProps) {
  const { asChild = false, className, children = "View all", ...linkProps } = props;

  const srSuffix = "srSuffix" in props ? props.srSuffix : undefined;
  const linkClass = cn(
    "inline-flex items-center gap-[11px] py-[18px] text-base font-semibold leading-6 tracking-[0.05em] text-on-surface",
    FOCUS_RING,
    className,
  );

  if (asChild) {
    return (
      <Slot className={linkClass} {...linkProps}>
        {children as ReactElement}
      </Slot>
    );
  }

  return (
    <a className={linkClass} {...linkProps}>
      <span>{children}</span>
      {srSuffix ? <span className="sr-only"> {srSuffix}</span> : null}
      <MarketingViewAllChevron />
    </a>
  );
}
