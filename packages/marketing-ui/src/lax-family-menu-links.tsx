import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { familyLinkAccentStyle } from "./family-link-accent.js";
import type { LaxFamilyBarLink } from "./lax-family-bar.js";

export type LaxFamilyMenuLinksProps = {
  links: readonly LaxFamilyBarLink[];
  /** Closes the menu once a link is chosen. */
  onNavigate?: () => void;
  /**
   * "list" stacks the links as 44px rows with "You're here" beside the current product. "row" is
   * the top bar as one line: the products, a divider, then LAX Account, with the current product
   * underlined in its accent.
   */
  layout?: "list" | "row";
  className?: string;
};

const ACCOUNT_ID = "account";

/**
 * The top bar's links inside a phone menu, where the bar is hidden: all the LAX products and LAX
 * Account in the bar's order, as 44px rows. The product the person is on says "You're here" in
 * words and keeps its link home.
 */
export function LaxFamilyMenuLinks({
  links,
  onNavigate,
  layout = "list",
  className,
}: LaxFamilyMenuLinksProps) {
  if (links.length === 0) return null;
  if (layout === "row")
    return <FamilyRow links={links} onNavigate={onNavigate} className={className} />;

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

/** The top bar as one line inside a phone menu; wraps rather than clips on the narrowest phones. */
function FamilyRow({
  links,
  onNavigate,
  className,
}: {
  links: readonly LaxFamilyBarLink[];
  onNavigate: (() => void) | undefined;
  className: string | undefined;
}) {
  return (
    <nav aria-label="LAX family menu" data-testid="lax-family-menu-links" className={className}>
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-5 p-0">
        {links.map((link) => (
          <li
            key={link.id}
            className={cn(
              "flex items-center",
              link.id === ACCOUNT_ID && "border-l border-on-surface-variant/35 pl-5",
            )}
          >
            <a
              href={link.href}
              aria-current={link.current ? "true" : undefined}
              rel={link.current ? undefined : "noopener noreferrer"}
              onClick={onNavigate}
              style={familyLinkAccentStyle(link.id)}
              className={cn(
                "relative inline-flex min-h-11 items-center rounded-sm font-label text-xs normal-case tracking-normal underline-offset-4 transition-colors hover:underline motion-reduce:transition-none",
                link.current
                  ? "font-semibold text-on-surface before:absolute before:inset-x-0 before:bottom-2 before:h-0.5 before:rounded-full before:bg-[var(--family-accent,currentColor)] before:content-[''] dark:before:bg-[var(--family-accent-on-dark,currentColor)]"
                  : "font-medium text-on-surface-variant hover:text-on-surface",
                FOCUS_RING,
              )}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
