import {
  HOSTED_FONT_FILES,
  HOSTED_GALLERY_IMAGE,
  HOSTED_IMAGE_BASE_PATH,
  type HostedFontFile,
  hostedFontPath,
} from "./lockups.js";
import { HOSTED_AUTH_ASSET_VERSION } from "./policy.js";
import { HOSTED_AUTH_TOKENS as t } from "./tokens.js";

const fontFace = (family: string, file: HostedFontFile) => `@font-face {
  font-family: "${family}";
  src: url("${hostedFontPath(file)}") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}`;

/**
 * Dark values, applied two ways: by the `dark` class the theme script and toggle set, and by the
 * system setting when no script ran (`html:not(.light)`), so a page without script still follows
 * the device.
 */
const DARK_TOKENS = `
    --color-page-bg: ${t.darkPageBg};
    --color-surface: ${t.darkSurface};
    --color-surface-container: ${t.darkSurfaceContainer};
    --color-on-surface: ${t.lightCream};
    --color-on-surface-variant: ${t.darkTextSecondary};
    --color-border: ${t.darkBorder};
    --color-input-border: ${t.darkInputBorder};
    --color-link: ${t.lightCream};
    --color-accent: ${t.accentOnDark};
    --color-cta-bg: ${t.ctaOnDark};
    --color-cta-on: ${t.obsidian};
    --color-error: #ffb4ab;
    --color-success: #56d364;
    --color-ring: ${t.accentOnDark};
    --color-product-bid: ${t.productBidOnDark};
    --color-product-shop: ${t.productShopOnDark};
    --color-product-art: ${t.lightCream};
    color-scheme: dark;`;

/**
 * One image per theme (lockups); the matching one shows. ":root" lifts these above the images'
 * own display rules, which come later in the sheet.
 */
const DARK_IMAGES = `
:root .only-dark { display: none; }
html.dark .only-dark { display: block; }
html.dark .only-light { display: none; }
html.dark .theme-icon--moon { display: none; }
html.dark .theme-icon--sun { display: block; }`;

const SYSTEM_DARK_IMAGES = `
  html:not(.light) .only-dark { display: block; }
  html:not(.light) .only-light { display: none; }
  html:not(.light) .theme-icon--moon { display: none; }
  html:not(.light) .theme-icon--sun { display: block; }`;

const GALLERY_URL = `${HOSTED_IMAGE_BASE_PATH}/${HOSTED_GALLERY_IMAGE}?v=${HOSTED_AUTH_ASSET_VERSION}`;

/**
 * Issuer-hosted credential CSS. Every hosted page is the LAX Account, so the accent is its
 * teal for all products; navy is LAX Bid's and never appears here (LAX colour rule).
 * The frame, fields and buttons follow LAX Account's signed-out page and forms (`SignInSplit`,
 * `FIELD` and the Account button in apps/account) so the whole sign-in flow is one family.
 * Served at `/hosted-auth.css` so CSP can stay `style-src 'self'`.
 * Selectors are scoped to semantic classes so utility controls never inherit CTAs.
 */
export const HOSTED_AUTH_STYLES = `${fontFace("Montserrat", HOSTED_FONT_FILES.montserrat)}

${fontFace("Outfit", HOSTED_FONT_FILES.outfit)}

:root {
  color-scheme: light;
  --color-page-bg: ${t.pageBg};
  --color-surface: ${t.surface};
  --color-surface-container: ${t.surfaceContainer};
  --color-on-surface: ${t.ink};
  --color-on-surface-variant: ${t.textSecondary};
  --color-border: ${t.border};
  --color-input-border: ${t.inputBorder};
  --color-link: ${t.ink};
  --color-accent: ${t.accent};
  --color-cta-bg: ${t.accent};
  --color-cta-on: ${t.white};
  --color-error: ${t.errorOnLight};
  --color-success: ${t.successOnLight};
  --color-ring: ${t.accent};
  --color-product-bid: ${t.productBid};
  --color-product-shop: ${t.productShop};
  --color-product-art: ${t.ink};
  --auth-column: 28rem;
  --radius: 0.375rem;
  --control-min: 2.75rem;
  --font-body: ${t.fontBody};
  /* LAX Account sets all of its text in Montserrat, so the hosted pages do too. */
  --font-supporting: ${t.fontBody};
}

html.dark {${DARK_TOKENS}
}

@media (prefers-color-scheme: dark) {
  html:not(.light) {${DARK_TOKENS}
  }
}
${DARK_IMAGES}

@media (prefers-color-scheme: dark) {${SYSTEM_DARK_IMAGES}
}

*, *::before, *::after { box-sizing: border-box; }

[hidden] { display: none !important; }

html, body {
  margin: 0;
  min-height: 100%;
}

body {
  min-height: 100vh;
  font-family: var(--font-body);
  background: var(--color-page-bg);
  color: var(--color-on-surface);
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 10;
  padding: 0.5rem 1rem;
  background: var(--color-cta-bg);
  color: var(--color-cta-on);
}

.skip-link:focus {
  left: 1rem;
  top: 1rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* The frame: the panel, and the painting beside it from 64rem. */

.auth-split {
  display: flex;
  min-height: 100vh;
}

.auth-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.auth-art {
  display: none;
}

.auth-header,
.auth-main,
.auth-footer {
  padding-left: 1rem;
  padding-right: 1rem;
}

.auth-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1.5rem;
}

.auth-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding-top: 2.5rem;
  padding-bottom: 3rem;
}

.auth-column {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  width: 100%;
  max-width: var(--auth-column);
}

.auth-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
  padding-top: 1rem;
  padding-bottom: 2rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-on-surface-variant);
}

.auth-footer p {
  margin: 0;
  text-wrap: balance;
}

.auth-footer nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1.5rem;
}

.auth-footer a {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-min);
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.auth-footer a:hover {
  color: var(--color-on-surface);
}

@media (min-width: 40rem) {
  .auth-header,
  .auth-main,
  .auth-footer {
    padding-left: 2.5rem;
    padding-right: 2.5rem;
  }

  .auth-main {
    padding-top: 3rem;
  }
}

@media (min-width: 64rem) {
  .auth-panel {
    max-width: 50%;
  }

  .auth-header,
  .auth-main,
  .auth-footer {
    padding-left: 4rem;
    padding-right: 4rem;
  }

  .auth-header {
    padding-top: 2.5rem;
  }

  /* Decoration only, so it is a background: a phone never downloads it. */
  .auth-art {
    position: sticky;
    top: 0;
    display: block;
    flex: 1;
    height: 100vh;
    background: var(--color-surface-container) url("${GALLERY_URL}") 50% 40% / cover no-repeat;
  }
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.brand-logo {
  display: block;
  height: 2.25rem;
  width: auto;
}

@media (min-width: 40rem) {
  .brand-logo {
    height: 2.5rem;
  }
}

.brand-tagline {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--control-min);
  height: var(--control-min);
  padding: 0;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-on-surface);
  cursor: pointer;
}

.theme-toggle:hover {
  background: color-mix(in srgb, var(--color-on-surface) 6%, transparent);
}

.theme-icon--sun {
  display: none;
}

/* Heading */

.heading {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

h1 {
  margin: 0;
  font-size: 1.875rem;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

@media (min-width: 40rem) {
  h1 {
    font-size: 2.25rem;
  }
}

.destination {
  margin: -0.25rem 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-on-surface-variant);
}

.lead {
  text-wrap: pretty;
  margin: 0;
  font-family: var(--font-supporting);
  font-size: 1rem;
  line-height: 1.75;
  color: var(--color-on-surface-variant);
}

.auth-stack,
.auth-form,
.auth-step {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.auth-stack {
  gap: 2rem;
}

.auth-form,
.auth-step {
  gap: 1.5rem;
}

.social-actions {
  display: grid;
  gap: 1.5rem;
}

/* Fields: LAX Account's field style (label above a 44px box with a 3:1 edge). */

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  width: 100%;
}

.field-label {
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  color: var(--color-on-surface);
}

.field-hint {
  margin: 0;
  font-family: var(--font-supporting);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-on-surface-variant);
}

.field-control {
  position: relative;
}

.field-input {
  display: block;
  width: 100%;
  height: var(--control-min);
  margin: 0;
  padding: 0 0.75rem;
  border: 1px solid var(--color-input-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--font-supporting);
  font-size: 1rem;
  line-height: 1.5;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.field-control-password .field-input {
  padding-right: 3rem;
}

.field-input:hover:not(:disabled) {
  border-color: var(--color-on-surface-variant);
}

/* Account's ring: 2px of the page, then 2px of the ring colour. */
.field-input:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-page-bg), 0 0 0 4px var(--color-ring);
}

.field-input[aria-invalid="true"],
.field-control.is-invalid .field-input {
  border-color: var(--color-error);
}

.field-input[aria-invalid="true"]:focus-visible,
.field-control.is-invalid .field-input:focus-visible {
  box-shadow: 0 0 0 2px var(--color-page-bg), 0 0 0 4px var(--color-error);
}

.field-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.field-input:-webkit-autofill,
.field-input:autofill {
  -webkit-box-shadow: 0 0 0 1000px var(--color-surface) inset;
  box-shadow: 0 0 0 1000px var(--color-surface) inset;
  -webkit-text-fill-color: var(--color-on-surface);
  caret-color: var(--color-on-surface);
}

.field-error {
  margin: 0;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-error);
}

/* Show password: an icon toggle inside the field; aria-pressed picks the icon. */
.btn-reveal {
  position: absolute;
  top: 50%;
  right: 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transform: translateY(-50%);
}

.btn-reveal:hover {
  color: var(--color-on-surface);
  background: color-mix(in srgb, var(--color-on-surface) 6%, transparent);
}

.btn-reveal .reveal-icon--hide,
.btn-reveal[aria-pressed="true"] .reveal-icon--show {
  display: none;
}

.btn-reveal[aria-pressed="true"] .reveal-icon--hide {
  display: block;
}

/* Buttons: Account's one size, 44px tall, 20px either side, 14px medium text, 6px radius. */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: var(--control-min);
  padding: 0.625rem 1.25rem;
  border: 0;
  border-radius: var(--radius);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.5;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  width: 100%;
  background: var(--color-cta-bg);
  color: var(--color-cta-on);
}

/* Account darkens its teal a step on hover and two when pressed, in both themes. */
.btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-cta-bg) 88%, black);
}

.btn-primary:active:not(:disabled) {
  background: color-mix(in srgb, var(--color-cta-bg) 78%, black);
}

.btn-secondary {
  width: 100%;
  background: transparent;
  color: var(--color-on-surface);
  border: 1px solid var(--color-border);
}

.btn-mark {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.btn-secondary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-on-surface) 4%, transparent);
}

.btn-link {
  width: auto;
  min-height: var(--control-min);
  padding: 0;
  background: transparent;
  color: var(--color-link);
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.email-summary {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.email-summary-label {
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-on-surface);
}

.email-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.email-summary-value {
  font-family: var(--font-supporting);
  font-size: 1rem;
  color: var(--color-on-surface);
  overflow-wrap: anywhere;
}

.field-row-end {
  display: flex;
  justify-content: flex-end;
  margin-top: -0.75rem;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
}

.field-check {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-on-surface);
}

.field-check input {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--color-accent);
  flex-shrink: 0;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
}

/* A link never breaks inside itself, so "Privacy notice" or "Sign up" stays whole. */
.text-link,
.links a {
  color: var(--color-link);
  text-decoration: underline;
  text-underline-offset: 0.25rem;
  white-space: nowrap;
}

.text-link:hover,
.links a:hover {
  text-decoration-thickness: 2px;
}

/* Links that stand on their own line get the 44px target; a link inside a sentence stays inline. */
.links a,
.field-row-end .text-link,
.links-secondary .text-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-min);
}

.product-name {
  font-weight: 500;
}

.product-name--bid {
  color: var(--color-product-bid);
}

.product-name--shop {
  color: var(--color-product-shop);
}

.product-name--art {
  color: var(--color-product-art);
}

.status-error,
#error {
  margin: 0;
  color: var(--color-error);
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
}

.status-success,
#success {
  margin: 0;
  color: var(--color-success);
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
}

ul,
ol {
  margin: 0 0 1.25rem;
  padding-left: 1.25rem;
  color: var(--color-on-surface-variant);
  font-family: var(--font-supporting);
}

/* "or" between the social buttons and the form; the lines clear 3:1 like a field's edge. */
.auth-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0;
  color: var(--color-on-surface-variant);
  font-family: var(--font-supporting);
  font-size: 0.875rem;
}

.auth-divider::before,
.auth-divider::after {
  content: "";
  flex: 1;
  border-top: 1px solid var(--color-input-border);
}

.auth-fineprint {
  margin: 0;
  font-family: var(--font-supporting);
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--color-on-surface-variant);
}

.turnstile-slot {
  min-height: 0;
}

.btn:focus-visible,
.btn-reveal:focus-visible,
.theme-toggle:focus-visible,
.text-link:focus-visible,
.skip-link:focus-visible,
a:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

/* The one-account promise under sign-in and sign-up. */

.one-account {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.one-account h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.one-account p {
  margin: 0;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-on-surface-variant);
}

.product-marks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 2rem;
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
}

.product-mark {
  display: block;
  height: 1.5rem;
  width: auto;
}

.staff-access-note {
  max-width: 28rem;
  line-height: 1.5;
}

.product-back {
  margin: 0 0 -1rem;
}

.product-back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: var(--control-min);
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-on-surface-variant);
  text-decoration: none;
}

.product-back-link:hover {
  color: var(--color-on-surface);
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.product-back-chevron {
  flex-shrink: 0;
}

.links.links--stacked {
  flex-direction: column;
  gap: 0.5rem;
}

.auth-hint {
  margin: 0;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-on-surface-variant);
}

.auth-qr {
  align-self: flex-start;
  width: 180px;
  height: 180px;
  padding: 0.5rem;
  border-radius: var(--radius);
  background: #ffffff;
}

.auth-qr svg {
  display: block;
  width: 100%;
  height: 100%;
}

.auth-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
  user-select: all;
}

pre.auth-mono {
  margin: 0;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-on-surface);
  font-size: 0.9375rem;
  line-height: 1.8;
  white-space: pre-wrap;
  columns: 2;
}

#setup-enrol,
#setup-backup {
  gap: 1.5rem;
}

#setup-backup {
  display: flex;
  flex-direction: column;
}

.links-secondary {
  margin: 0;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
}

@media (max-width: 32rem) {
  .actions {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;
