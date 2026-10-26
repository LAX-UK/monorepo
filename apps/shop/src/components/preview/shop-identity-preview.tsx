import { loadShopEnv } from "@/env";
import {
  SHOP_ACCENT_CANDIDATES,
  SHOP_LOCKUP_VARIANTS,
  type ShopAccentCandidate,
  type ShopLockupVariant,
  shopLockupCandidate,
} from "@auction/branding";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

/** The identity preview is a design checkpoint: never served on production. */
export function assertIdentityPreviewAvailable(): void {
  if (loadShopEnv().SHOP_DEPLOY_ENV === "production") notFound();
}

export function findPreviewPairing(variantId: string, accentId: string) {
  const variant = SHOP_LOCKUP_VARIANTS.find((item) => item.id === variantId);
  const accent = SHOP_ACCENT_CANDIDATES.find((item) => item.id === accentId);
  return variant && accent ? { variant, accent } : null;
}

const MIST = "#b9bac0";

/** The candidate lockup, painted with the panel's ink and the candidate accent. */
export function CandidateLockup({
  variant,
  className,
}: {
  variant: ShopLockupVariant;
  className?: string;
}) {
  const lockup = shopLockupCandidate(variant);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={lockup.viewBox}
      role="img"
      aria-label={lockup.label}
      className={className}
      fill="currentColor"
    >
      <title>{lockup.label}</title>
      {lockup.ink.map((path) => (
        <path key={path.d} d={path.d} />
      ))}
      {lockup.mist.map((path) => (
        <path key={path.d} d={path.d} fill={MIST} />
      ))}
      {lockup.descriptorPaths.map((path) => (
        <path key={path.d} d={path.d} style={{ fill: "var(--idp-accent)" }} />
      ))}
    </svg>
  );
}

type Scheme = "light" | "dark";

function panelStyle(accent: ShopAccentCandidate, scheme: Scheme): CSSProperties {
  return { ["--idp-accent" as string]: scheme === "light" ? accent.light : accent.dark };
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="idp-icon">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m20 20-4-4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BagGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="idp-icon">
      <path
        d="M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MenuGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="idp-icon">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** One scheme of one pairing: header, page detail with accent uses, footer and a phone header. */
function Panel({
  variant,
  accent,
  scheme,
}: {
  variant: ShopLockupVariant;
  accent: ShopAccentCandidate;
  scheme: Scheme;
}) {
  return (
    <section
      className={`idp-panel idp-panel--${scheme}`}
      style={panelStyle(accent, scheme)}
      aria-label={`${scheme === "light" ? "Light" : "Dark"} surfaces`}
    >
      <p className="idp-scheme">
        {scheme === "light" ? "Light" : "Dark"} · accent{" "}
        <code>{scheme === "light" ? accent.light : accent.dark}</code>
      </p>

      <div className="idp-header" aria-label="Header at desktop size">
        <CandidateLockup variant={variant} className="idp-lockup idp-lockup--header" />
        <nav className="idp-nav" aria-label="Sample navigation">
          <span className="idp-nav__item is-active">Editions</span>
          <span className="idp-nav__item">Artists</span>
        </nav>
        <span className="idp-search">
          Search editions and artists <SearchGlyph />
        </span>
        <BagGlyph />
      </div>

      <div className="idp-body">
        <p className="idp-copy">
          Limited edition of 24 · Available.{" "}
          <span className="idp-link">UK insured delivery £15.00</span> ·{" "}
          <span className="idp-link">14-day cancellation</span>
        </p>
        <div className="idp-actions">
          <span className="idp-button idp-button--ink">Add to basket</span>
          <span className="idp-button idp-button--secondary idp-focus">Focus ring</span>
          <span className="idp-chip">Search: em ×</span>
        </div>
      </div>

      <div className="idp-footer" aria-label="Footer at desktop size">
        <CandidateLockup variant={variant} className="idp-lockup idp-lockup--footer" />
        <ul className="idp-footer__links">
          <li>Terms of sale</li>
          <li className="idp-link">Returns and cancellation</li>
          <li>Shipping and delivery</li>
        </ul>
      </div>

      <div className="idp-phone" aria-label="Phone header">
        <CandidateLockup variant={variant} className="idp-lockup idp-lockup--phone" />
        <span className="idp-phone__icons">
          <SearchGlyph />
          <BagGlyph />
          <MenuGlyph />
        </span>
      </div>
    </section>
  );
}

export function PairingPreview({
  variant,
  accent,
}: {
  variant: (typeof SHOP_LOCKUP_VARIANTS)[number];
  accent: ShopAccentCandidate;
}) {
  return (
    <main id="main-content" className="idp">
      <p className="idp-back">
        <Link href="/preview/identity">All pairings</Link>
      </p>
      <h1 className="idp-title">
        ({variant.letter}) {variant.name} · {accent.name}
      </h1>
      <p className="idp-lede">
        {variant.summary} {accent.rationale}
      </p>
      <div className="idp-panels">
        <Panel variant={variant.id} accent={accent} scheme="light" />
        <Panel variant={variant.id} accent={accent} scheme="dark" />
      </div>
    </main>
  );
}

export function PairingGrid() {
  return (
    <main id="main-content" className="idp">
      <h1 className="idp-title">LAX Shop identity: lockup and accent candidates</h1>
      <p className="idp-lede">
        The London Art Exchange wordmark stays as it is; each variant adds “Shop” in the accent.
        Primary buttons stay ink. Open a pairing for header, footer, phone and accent uses.
      </p>
      <ul className="idp-accents">
        {SHOP_ACCENT_CANDIDATES.map((accent) => (
          <li key={accent.id}>
            <span className="idp-swatch" style={{ background: accent.light }} />
            <span className="idp-swatch" style={{ background: accent.dark }} />
            <strong>{accent.name}</strong> {accent.light} / {accent.dark}. {accent.rationale}
          </li>
        ))}
      </ul>
      <div className="idp-grid">
        <span />
        {SHOP_ACCENT_CANDIDATES.map((accent) => (
          <p key={accent.id} className="idp-grid__head">
            {accent.name}
          </p>
        ))}
        {SHOP_LOCKUP_VARIANTS.map((variant) => (
          <div key={variant.id} className="idp-grid__row">
            <p className="idp-grid__head">
              ({variant.letter}) {variant.name}
            </p>
            {SHOP_ACCENT_CANDIDATES.map((accent) => (
              <Link
                key={accent.id}
                href={`/preview/identity/${variant.id}/${accent.id}`}
                className="idp-grid__cell"
                aria-label={`${variant.name} with ${accent.name}`}
              >
                <span
                  className="idp-grid__swatch idp-panel--light"
                  style={panelStyle(accent, "light")}
                >
                  <CandidateLockup variant={variant.id} className="idp-lockup idp-lockup--header" />
                </span>
                <span
                  className="idp-grid__swatch idp-panel--dark"
                  style={panelStyle(accent, "dark")}
                >
                  <CandidateLockup variant={variant.id} className="idp-lockup idp-lockup--header" />
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
