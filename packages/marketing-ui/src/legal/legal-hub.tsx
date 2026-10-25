import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type LegalHubLink = {
  href: string;
  label: string;
  current?: boolean;
  /** Lives on another LAX product (for example the group privacy notice on LAX Bid). */
  external?: boolean;
};

export type LegalHubProps = {
  /** Accessible name of the page list, for example "Policies". */
  label: string;
  links: readonly LegalHubLink[];
  className?: string;
  children: ReactNode;
};

/**
 * The list of a product's policy pages beside the open document: a sticky column on wide
 * screens, a scrolling row of tabs above the document on narrow ones.
 */
export function LegalHub({ label, links, className, children }: LegalHubProps) {
  return (
    <div className={cn("lax-legal-hub", className)}>
      {links.length > 0 ? (
        <nav aria-label={label} className="lax-legal-hub__nav">
          <ul className="lax-legal-hub__list">
            {links.map((link) => (
              <li key={link.href}>
                {link.external ? (
                  <a href={link.href} className="lax-legal-hub__link">
                    {link.label}
                  </a>
                ) : (
                  <Link
                    href={link.href}
                    className="lax-legal-hub__link"
                    aria-current={link.current ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <div className="lax-legal-hub__main">{children}</div>
    </div>
  );
}
