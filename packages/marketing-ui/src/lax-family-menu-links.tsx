import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import type { LaxFamilyBarLink } from "./lax-family-bar.js";

export type LaxFamilyMenuLinksProps = {
  links: readonly LaxFamilyBarLink[];
  /** Closes the menu once a link is chosen. */
  onNavigate?: () => void;
  className?: string;
};

/**
 * The top bar's links inside a phone menu, where the bar is hidden: all the LAX products and LAX
 * Account in the bar's order, as 44px rows. The product the person is on says "You're here" in
 * words and keeps its link home.
 */
export function LaxFamilyMenuLinks({ links, onNavigate, className }: LaxFamilyMenuLinksProps) {
  if (links.length === 0) return null;

  return (
    <nav
      aria-label="LAX family menu"
      data-testid="lax-family-menu-links"
      className={cn("flex flex-col gap-1", className)}
    >
      <p className="m-0 font-label text-xs font-semibold leading-4 text-on-surface-variant">
        LAX products
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              aria-current={link.current ? "true" : undefined}
              rel={link.current ? undefined : "noopener noreferrer"}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 rounded-sm font-label text-sm normal-case tracking-normal text-on-surface underline-offset-4 transition-colors hover:underline motion-reduce:transition-none",
                link.current ? "font-semibold" : "font-medium",
                FOCUS_RING,
              )}
            >
              {link.label}
              {link.current ? (
                <span className="text-xs font-medium text-on-surface-variant">
                  You&apos;re here
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
