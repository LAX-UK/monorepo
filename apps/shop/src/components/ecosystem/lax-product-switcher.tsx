import { FOCUS_RING } from "@auction/branding";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { type MarketingHeaderTone, headerProductNameClass } from "@auction/marketing-ui";
import { cn } from "@auction/ui";

type Props = {
  links: LaxProductLinkVm[];
  headerTone?: MarketingHeaderTone;
};

export function LaxProductSwitcher({ links, headerTone = "on-light" }: Props) {
  if (links.length === 0) return null;

  return (
    <nav aria-label="LAX products" className="flex flex-wrap items-center gap-4">
      {links.map((link) =>
        link.current ? (
          <span
            key={link.id}
            className={headerProductNameClass(headerTone, true)}
            aria-current="page"
          >
            {link.label}
          </span>
        ) : (
          <a
            key={link.id}
            href={link.href}
            className={cn(headerProductNameClass(headerTone, false), FOCUS_RING)}
            rel="noopener noreferrer"
          >
            {link.label}
          </a>
        ),
      )}
    </nav>
  );
}
