import type { HostedNamedProduct, HostedProductChip } from "./brand.js";
import { HOSTED_COPY } from "./copy.js";
import { escapeHostedHtml } from "./escape.js";
import type { HostedFooterLinks } from "./legal-links.js";
import {
  HOSTED_LOCKUP_BASE_PATH,
  HOSTED_PRODUCT_LOCKUPS,
  hostedLockupPath,
  hostedLockupWidth,
} from "./lockups.js";

/**
 * The frame every hosted page shares with LAX Account's signed-out page (`SignInSplit` in
 * apps/account): the Account lockup and theme toggle across the top of the panel, who provides
 * the account at its foot, and the gallery painting beside it on wide screens (drawn by the
 * stylesheet, so a phone never downloads it). Keep the two in step.
 */

const ACCOUNT_LOCKUP_HEIGHT = 40;
const ACCOUNT_LOCKUP_WIDTH = hostedLockupWidth(ACCOUNT_LOCKUP_HEIGHT);
const PRODUCT_MARK_HEIGHT = 28;

/** Lucide's moon and sun at 20px, the icons LAX Account's header toggle draws. */
const MOON_ICON = `<svg class="theme-icon theme-icon--moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>`;
const SUN_ICON = `<svg class="theme-icon theme-icon--sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;

/** One image per theme; the stylesheet shows the one that matches, so only it is announced. */
function themedImage(input: {
  light: string;
  dark: string;
  alt: string;
  width: number;
  height: number;
  className: string;
}): string {
  const common = `alt="${escapeHostedHtml(input.alt)}" width="${input.width}" height="${input.height}"`;
  return `<img class="${input.className} only-light" src="${escapeHostedHtml(input.light)}" ${common}><img class="${input.className} only-dark" src="${escapeHostedHtml(input.dark)}" ${common}>`;
}

/** Hidden until the theme script wires it, so a page without script never shows a dead button. */
function themeToggle(): string {
  const { toDark, toLight } = HOSTED_COPY.theme;
  return `<button type="button" class="theme-toggle" data-theme-toggle data-label-dark="${escapeHostedHtml(toDark)}" data-label-light="${escapeHostedHtml(toLight)}" aria-label="${escapeHostedHtml(toDark)}" aria-pressed="false" hidden>${MOON_ICON}${SUN_ICON}</button>`;
}

export function hostedHeader(input: { assetSuffix: string; tagline: string | null }): string {
  const logo = themedImage({
    light: `${hostedLockupPath("light")}${input.assetSuffix}`,
    dark: `${hostedLockupPath("dark")}${input.assetSuffix}`,
    alt: HOSTED_COPY.accountName,
    width: ACCOUNT_LOCKUP_WIDTH,
    height: ACCOUNT_LOCKUP_HEIGHT,
    className: "brand-logo",
  });
  const tagline = input.tagline
    ? `<p class="brand-tagline">${escapeHostedHtml(input.tagline)}</p>`
    : "";
  return `<header class="auth-header">
      <div class="brand">${logo}${tagline}</div>
      ${themeToggle()}
    </header>`;
}

export function productName(product: HostedNamedProduct, label: string): string {
  return `<span class="product-name product-name--${product}">${escapeHostedHtml(label)}</span>`;
}

export type HostedLeadKey = keyof typeof HOSTED_COPY.leads;

/** A page's lead, naming the destination product in its own colour when there is one. */
export function leadWithDestination(key: HostedLeadKey, chip: HostedProductChip | null): string {
  const lead = HOSTED_COPY.leads[key];
  if (!chip) return escapeHostedHtml(lead.alone);
  return `${escapeHostedHtml(lead.toProduct)} ${productName(chip.product, chip.label)}.`;
}

/** "to continue to LAX Bid", under the heading, when the person came from a product. */
export function destinationLine(chip: HostedProductChip | null): string {
  if (!chip) return "";
  return `<p class="destination">${escapeHostedHtml(HOSTED_COPY.continueTo)} ${productName(chip.product, chip.label)}</p>`;
}

/**
 * The one-account promise LAX Account's landing used to make: one sign-in for Bid, Shop and
 * lax.art, with their marks. The sentence names the products, so the marks are decoration.
 */
export function oneAccountSection(assetSuffix: string): string {
  const { bid, shop, art } = HOSTED_COPY.oneAccountProducts;
  const marks = (Object.keys(HOSTED_PRODUCT_LOCKUPS) as HostedNamedProduct[])
    .map((product) => {
      const lockup = HOSTED_PRODUCT_LOCKUPS[product];
      const base = `${HOSTED_LOCKUP_BASE_PATH}/`;
      return `<li>${themedImage({
        light: `${base}${lockup.light}${assetSuffix}`,
        dark: `${base}${lockup.dark}${assetSuffix}`,
        alt: "",
        width: Math.round(PRODUCT_MARK_HEIGHT * lockup.aspect),
        height: PRODUCT_MARK_HEIGHT,
        className: "product-mark",
      })}</li>`;
    })
    .join("");
  return `<section class="one-account" aria-labelledby="one-account-title">
      <h2 id="one-account-title">${escapeHostedHtml(HOSTED_COPY.oneAccountTitle)}</h2>
      <p>${escapeHostedHtml(HOSTED_COPY.oneAccountLead)} ${productName("bid", bid)}, ${productName("shop", shop)} and ${productName("art", art)}.</p>
      <ul class="product-marks" aria-hidden="true">${marks}</ul>
    </section>`;
}

export function hostedFooter(links: HostedFooterLinks | null, year: number): string {
  const nav = links
    ? `<nav aria-label="Legal and help">
        <a href="${escapeHostedHtml(links.privacy)}">${escapeHostedHtml(HOSTED_COPY.footer.privacy)}</a>
        <a href="${escapeHostedHtml(links.help)}">${escapeHostedHtml(HOSTED_COPY.footer.help)}</a>
      </nav>`
    : "";
  return `<footer class="auth-footer">
      <p>© ${year} LAX. ${escapeHostedHtml(HOSTED_COPY.accountOperators)}</p>
      ${nav}
    </footer>`;
}
