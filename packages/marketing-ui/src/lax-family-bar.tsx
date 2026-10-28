import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import type { MarketingHeaderTone } from "./header/header-chrome-tone.js";

/** One entry of the LAX top bar. `@auction/lax-ecosystem`'s `LaxFamilyLinkVm` fits it. */
export type LaxFamilyBarLink = {
  id: string;
  label: string;
  href: string;
  current: boolean;
};

/** The shared account every product links to; it closes the bar after a divider. */
const ACCOUNT_ID = "account";

type ToneClasses = {
  link: string;
  current: string;
  muted: string;
  divider: string;
};

/** Colours per header tone: the page surface, or a transparent header over a photograph. */
const TONES: Readonly<Record<MarketingHeaderTone, ToneClasses>> = {
  "on-light": {
    link: "text-on-surface-variant hover:text-on-surface",
    current: "text-on-surface",
    muted: "text-on-surface-variant",
    divider: "border-on-surface-variant/35",
  },
  "on-dark": {
    link: "text-hero-foreground/80 hover:text-hero-foreground",
    current: "text-hero-foreground",
    muted: "text-hero-foreground/80",
    divider: "border-hero-foreground/30",
  },
};

/**
 * Each name is a 16px line; an invisible box widens its hit area to the bar's full 36px height
 * so the bar stays thin. Names keep their written form ("lax.art"), never upper-cased.
 */
const LINK =
  "relative rounded-sm font-label text-xs leading-4 normal-case tracking-normal underline-offset-4 transition-colors after:absolute after:-inset-x-1.5 after:-inset-y-2.5 after:content-[''] hover:underline motion-reduce:transition-none";

export type LaxFamilyBarProps = {
  links: readonly LaxFamilyBarLink[];
  /** A short note on the right, such as delivery terms. Plain text, one line. */
  message?: string;
  /** Product controls that share the row (theme, sign in), after the message. */
  actions?: ReactNode;
  tone?: MarketingHeaderTone;
  className?: string;
};

function FamilyLink({ link, tone }: { link: LaxFamilyBarLink; tone: ToneClasses }) {
  return (
    <a
      href={link.href}
      aria-current={link.current ? "true" : undefined}
      rel={link.current ? undefined : "noopener noreferrer"}
      className={cn(
        LINK,
        FOCUS_RING,
        link.current ? cn("font-semibold", tone.current) : cn("font-medium", tone.link),
      )}
    >
      {link.label}
    </a>
  );
}

/**
 * The thin LAX top bar on every client-facing product: LAX Bid · lax.art · LAX Shop, then LAX
 * Account, with the product the person is on marked (`aria-current`, full ink, semibold). It is
 * hidden below `lg`, where each product's menu lists the same links (`LaxFamilyMenuLinks`).
 */
export function LaxFamilyBar({
  links,
  message,
  actions,
  tone = "on-light",
  className,
}: LaxFamilyBarProps) {
  if (links.length === 0) return null;
  const colours = TONES[tone];
  const products = links.filter((link) => link.id !== ACCOUNT_ID);
  const account = links.find((link) => link.id === ACCOUNT_ID);
  const hasAside = Boolean(message) || Boolean(actions);

  return (
    <div
      data-testid="lax-family-bar"
      className={cn("hidden min-h-9 items-center justify-between gap-6 lg:flex", className)}
    >
      <nav aria-label="LAX products">
        <ul className="m-0 flex list-none items-center p-0">
          {products.map((link, index) => (
            <li key={link.id} className="flex items-center">
              {index > 0 ? (
                <span aria-hidden className={cn("px-2.5 text-xs leading-4", colours.muted)}>
                  ·
                </span>
              ) : null}
              <FamilyLink link={link} tone={colours} />
            </li>
          ))}
          {account ? (
            <li
              className={cn(
                "flex items-center",
                products.length > 0 && cn("ml-4 border-l pl-4", colours.divider),
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
          {actions}
        </div>
      ) : null}
    </div>
  );
}
