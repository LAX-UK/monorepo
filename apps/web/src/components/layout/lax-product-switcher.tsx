import { FOCUS_RING } from "@/lib/marketing/chrome";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { headerProductNameClass } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  links: LaxProductLinkVm[];
  className?: string;
};

export function LaxProductSwitcher({ links, className }: Props) {
  if (links.length === 0) return null;

  return (
    <nav aria-label="LAX products" className={cn("flex flex-wrap items-center gap-4", className)}>
      {links.map((link) =>
        link.current ? (
          <span
            key={link.id}
            className={headerProductNameClass("on-light", true)}
            aria-current="page"
          >
            {link.label}
          </span>
        ) : link.external ? (
          <a
            key={link.id}
            href={link.href}
            className={cn(headerProductNameClass("on-light", false), FOCUS_RING)}
            rel="noopener noreferrer"
          >
            {link.label}
          </a>
        ) : (
          <Link
            key={link.id}
            href={link.href}
            className={cn(headerProductNameClass("on-light", false), FOCUS_RING)}
          >
            {link.label}
          </Link>
        ),
      )}
    </nav>
  );
}
