import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { familyLinkAccentStyle } from "./family-link-accent.js";
import type { MarketingHeaderTone } from "./header/header-chrome-tone.js";

/** One entry of the LAX top bar. `@auction/lax-ecosystem`'s `LaxFamilyLinkVm` fits it. */
export type LaxFamilyBarLink = {
  id: string;
  label: string;
  href: string;
  current: boolean;
};

const MAX_HELP_LINKS = 3;

/** A help link: muted 12px type inside a box as tall as the bar (36px). */
const HELP_LINK =
  "inline-flex min-h-9 items-center rounded-sm font-label text-xs leading-4 normal-case tracking-normal transition-colors motion-reduce:transition-none";

/** The shared account every product links to; it closes the bar after a divider. */
const ACCOUNT_ID = "account";

type ToneClasses = {
  link: string;
  current: string;
  muted: string;
  divider: string;
  /** The 2px line under the product the person is on. */
  underline: string;
  /** Whether the line takes the product's own accent (on a photograph it keeps the text colour). */
  accented: boolean;
};

/**
 * The bar's colours: the page surface, a transparent header over a photograph, or `follow-header`
 * for a bar drawn on the server, which takes the header's tone from the header's own
 * `data-header-tone` (the header carries the `group/header` class) so it never needs the tone as
 * a prop and none of the bar has to be sent to the browser.
 */
export type LaxFamilyBarTone = MarketingHeaderTone | "follow-header";

/** Colours per tone. */
const TONES: Readonly<Record<LaxFamilyBarTone, ToneClasses>> = {
  "on-light": {
    link: "text-on-surface-variant hover:text-on-surface",
    current: "text-on-surface",
    muted: "text-on-surface-variant",
    divider: "border-on-surface-variant/35",
    underline:
      "before:bg-[var(--family-accent,currentColor)] dark:before:bg-[var(--family-accent-on-dark,currentColor)]",
    accented: true,
  },
  "on-dark": {
    link: "text-hero-foreground/80 hover:text-hero-foreground",
    current: "text-hero-foreground",
    muted: "text-hero-foreground/80",
    divider: "border-hero-foreground/30",
    underline: "before:bg-current",
    accented: false,
  },
  "follow-header": {
    link: "text-on-surface-variant hover:text-on-surface group-data-[header-tone=on-dark]/header:text-hero-foreground/80 group-data-[header-tone=on-dark]/header:hover:text-hero-foreground",
    current: "text-on-surface group-data-[header-tone=on-dark]/header:text-hero-foreground",
    muted:
      "text-on-surface-variant group-data-[header-tone=on-dark]/header:text-hero-foreground/80",
    divider:
      "border-on-surface-variant/35 group-data-[header-tone=on-dark]/header:border-hero-foreground/30",
    underline:
      "before:bg-[var(--family-accent,currentColor)] dark:before:bg-[var(--family-accent-on-dark,currentColor)] group-data-[header-tone=on-dark]/header:before:bg-current group-data-[header-tone=on-dark]/header:dark:before:bg-current",
    accented: true,
  },
};

/**
 * Each name is a 16px line; an invisible box widens its hit area to the bar's full 36px height
 * so the bar stays thin. The underline is a pseudo-element hanging below the line, so showing it
 * (current product, hover) moves nothing. Names keep their written form ("lax.art").
 */
const LINK =
  "relative rounded-sm font-label text-xs leading-4 normal-case tracking-normal transition-colors after:absolute after:-inset-x-1.5 after:-inset-y-2.5 after:content-[''] before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-1 before:h-0.5 before:rounded-full before:content-[''] before:transition-colors motion-reduce:transition-none motion-reduce:before:transition-none";

/**
 * A sibling answers hover with a 1px line in the text colour, lighter than the current product's
 * 2px accent line, so the two never read as the same state. Same bottom edge, no layout change.
 */
const HOVER_UNDERLINE = "hover:before:-bottom-[3px] hover:before:h-px hover:before:bg-current";

/** One of the help links on the right of the bar (for example Help, Contact, Delivery). */
export type LaxFamilyBarHelpLink = {
  label: string;
  href: string;
  /**
   * Replaces the anchor with the product's own control (for example a button that opens a sheet).
   * It receives the help-link class so it matches its neighbours; `href` stays as the fallback.
   */
  render?: (className: string) => ReactNode;
};

export type LaxFamilyBarProps = {
  links: readonly LaxFamilyBarLink[];
  /** Up to three help links on the right: 12px muted type, each with a 36px hit area. */
  helpLinks?: readonly LaxFamilyBarHelpLink[];
  /**
   * A short note on the right. Plain text, one line.
   * @deprecated Use `helpLinks`. Kept until every product has adopted the shared header.
   */
  message?: string;
  /**
   * Product controls that share the row.
   * @deprecated Controls move to the product action row. Kept until every product has adopted it.
   */
  actions?: ReactNode;
  tone?: LaxFamilyBarTone;
  className?: string;
};

function FamilyLink({ link, tone }: { link: LaxFamilyBarLink; tone: ToneClasses }) {
  return (
    <a
      href={link.href}
      aria-current={link.current ? "true" : undefined}
      rel={link.current ? undefined : "noopener noreferrer"}
      style={tone.accented ? familyLinkAccentStyle(link.id) : undefined}
      className={cn(
        LINK,
        FOCUS_RING,
        link.current
          ? cn("font-semibold", tone.current, tone.underline)
          : cn("font-medium before:bg-transparent", tone.link, HOVER_UNDERLINE),
      )}
    >
      {link.label}
    </a>
  );
}

/**
 * The thin LAX top bar on every client-facing product: lax.art, lax.shop, lax.bid, then LAX
 * Account after a divider, always in that order. The product the person is on is marked
 * (`aria-current`, full ink, semibold, a 2px underline in its accent) and still links home. It is
 * hidden below `lg`, where each product's menu lists the same links (`LaxFamilyMenuLinks`).
 */
export function LaxFamilyBar({
  links,
  helpLinks,
  message,
  actions,
  tone = "on-light",
  className,
}: LaxFamilyBarProps) {
  if (links.length === 0) return null;
  const colours = TONES[tone];
  const products = links.filter((link) => link.id !== ACCOUNT_ID);
  const account = links.find((link) => link.id === ACCOUNT_ID);
  const help = (helpLinks ?? []).slice(0, MAX_HELP_LINKS);
  const hasAside = Boolean(message) || Boolean(actions) || help.length > 0;

  return (
    <div
      data-testid="lax-family-bar"
      className={cn("hidden min-h-9 items-center justify-between gap-6 lg:flex", className)}
    >
      <nav aria-label="LAX family">
        <ul className="m-0 flex list-none items-center gap-5 p-0">
          {products.map((link) => (
            <li key={link.id} className="flex items-center">
              <FamilyLink link={link} tone={colours} />
            </li>
          ))}
          {account ? (
            <li
              className={cn(
                "flex items-center",
                products.length > 0 && cn("border-l pl-5", colours.divider),
              )}
            >
              <FamilyLink link={account} tone={colours} />
            </li>
          ) : null}
        </ul>
      </nav>
      {hasAside ? (
        <div className="flex shrink-0 items-center gap-6">
          {message ? (
            <p className={cn("m-0 font-label text-xs leading-4", colours.muted)}>{message}</p>
          ) : null}
          {help.length > 0 ? (
            <nav aria-label="Help">
              <ul className="m-0 flex list-none items-center gap-4 p-0">
                {help.map((link) => (
                  <li key={link.href} className="flex items-center">
                    {link.render ? (
                      link.render(cn(HELP_LINK, colours.muted, "hover:underline", FOCUS_RING))
                    ) : (
                      <a
                        href={link.href}
                        className={cn(HELP_LINK, colours.muted, "hover:underline", FOCUS_RING)}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
