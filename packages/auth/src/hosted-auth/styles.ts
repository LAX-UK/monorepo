import { HOSTED_AUTH_TOKENS as t } from "./tokens.js";

/**
 * Issuer-hosted credential CSS — Bid auth chrome / Brand Identity v1.0.
 * Served at `/hosted-auth.css` so CSP can stay `style-src 'self'`.
 * Selectors are scoped to semantic classes so utility controls never inherit CTAs.
 */
export const HOSTED_AUTH_STYLES = `:root {
  color-scheme: light dark;
  --color-page-bg: ${t.pageBg};
  --color-surface: ${t.surface};
  --color-on-surface: ${t.ink};
  --color-on-surface-variant: ${t.textSecondary};
  --color-border: ${t.border};
  --color-input-border: ${t.border};
  --color-link: ${t.midnight};
  --color-cta-bg: ${t.obsidian};
  --color-cta-on: ${t.lightCream};
  --color-error: ${t.red};
  --color-success: #2ea043;
  --color-ring: ${t.midnight};
  --color-scrim-auth: rgba(0, 0, 0, 0.07);
  --auth-column: 528px;
  --radius: 0.5rem;
  --control-min: 2.75rem;
  --label-tracking: 0.08em;
  --font-body: ${t.fontBody};
  --font-supporting: ${t.fontSupporting};
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-page-bg: ${t.darkPageBg};
    --color-surface: ${t.darkSurface};
    --color-on-surface: ${t.lightCream};
    --color-on-surface-variant: ${t.darkTextSecondary};
    --color-border: ${t.darkBorder};
    --color-input-border: ${t.darkBorder};
    --color-link: color-mix(in srgb, ${t.midnight} 60%, white);
    --color-cta-bg: ${t.lightCream};
    --color-cta-on: ${t.obsidian};
    --color-error: #ffb4ab;
    --color-success: #56d364;
    --color-ring: color-mix(in srgb, ${t.midnight} 60%, white);
    --color-scrim-auth: rgba(255, 255, 255, 0.06);
  }
}

*, *::before, *::after { box-sizing: border-box; }

[hidden] { display: none !important; }

html, body {
  margin: 0;
  min-height: 100%;
}

body {
  position: relative;
  min-height: 100vh;
  font-family: var(--font-body);
  background: var(--color-page-bg);
  color: var(--color-on-surface);
}

body::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse 80% 50% at 50% -20%, var(--color-scrim-auth), transparent);
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

main {
  position: relative;
  margin: 0 auto;
  max-width: var(--auth-column);
  padding: 4rem 1.5rem 5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.brand-mark {
  margin: 0;
  font-size: clamp(1.875rem, 4vw, 2.25rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1;
  text-transform: uppercase;
}

.brand-sub {
  margin: 0.35rem 0 0;
  font-family: var(--font-supporting);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--color-link);
}

.heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}

h1 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  text-transform: uppercase;
}

.lead {
  margin: 0;
  max-width: 28rem;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--color-on-surface-variant);
}

.panel {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--color-border) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
  padding: 1.5rem;
}

.auth-stack,
.auth-form,
.auth-step {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.auth-stack,
.auth-form {
  gap: 2.5rem;
}

.auth-step {
  gap: 1.5rem;
}

.social-actions {
  display: grid;
  gap: 1.5rem;
}

.field {
  width: 100%;
}

.field-control {
  position: relative;
  border: 0;
  border-bottom: 1px solid var(--color-input-border);
  border-radius: 0.125rem 0.125rem 0 0;
  background: transparent;
  padding: 1.25rem 0 0.5rem;
  transition: border-color 150ms ease;
}

.field-control-password {
  padding-right: 4.5rem;
}

.field-label {
  pointer-events: none;
  position: absolute;
  left: 0;
  top: 1rem;
  font-family: var(--font-supporting);
  font-size: 1rem;
  line-height: 1.5;
  letter-spacing: 0.03125em;
  color: var(--color-on-surface-variant);
  transition: top 150ms ease, font-size 150ms ease, letter-spacing 150ms ease;
}

.field-input:focus + .field-label,
.field-input:not(:placeholder-shown) + .field-label,
.field-input:-webkit-autofill + .field-label,
.field-input:autofill + .field-label {
  top: 0;
  font-size: 0.75rem;
  line-height: 1.125rem;
  letter-spacing: 0.01em;
}

.field-input {
  display: block;
  width: 100%;
  min-height: 1.5rem;
  margin: 0;
  border: 0;
  background: transparent;
  color: var(--color-on-surface);
  font-family: var(--font-supporting);
  font-size: 1rem;
  line-height: 1.5;
  letter-spacing: 0.03125em;
  outline: none;
}

.field-input::placeholder {
  color: transparent;
}

.field-input:-webkit-autofill,
.field-input:autofill {
  -webkit-box-shadow: 0 0 0 1000px transparent inset;
  box-shadow: 0 0 0 1000px transparent inset;
  -webkit-text-fill-color: var(--color-on-surface);
  caret-color: var(--color-on-surface);
  background-color: transparent !important;
  transition: background-color 99999s ease-out;
}

.field-control:focus-within {
  border-bottom-color: var(--color-ring);
}

.field-control.is-invalid,
.field-control:has(.field-input[aria-invalid="true"]) {
  border-bottom-color: var(--color-error);
}

.field-error {
  margin: 0.25rem 0 0;
  font-family: var(--font-supporting);
  font-size: 0.75rem;
  color: var(--color-error);
}

.btn-reveal {
  position: absolute;
  right: 0;
  bottom: 0.125rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-height: var(--control-min);
  min-width: var(--control-min);
  padding: 0.5rem;
  border: 0;
  background: transparent;
  color: var(--color-on-surface-variant);
  font-family: var(--font-supporting);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  cursor: pointer;
}

.btn-reveal:hover {
  color: var(--color-on-surface);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-min);
  padding: 0.75rem 1.25rem;
  border: 0;
  border-radius: 0.25rem;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
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

.btn-primary:hover:not(:disabled) {
  opacity: 0.92;
}

.btn-secondary {
  width: 100%;
  background: transparent;
  color: var(--color-on-surface);
  border: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
}

.btn-secondary:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-link) 50%, transparent);
}

.btn-link {
  width: auto;
  min-height: auto;
  padding: 0;
  background: transparent;
  color: var(--color-link);
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  text-decoration: none;
}

.btn-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.25rem;
}

.email-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.email-summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}

.email-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.email-summary-value {
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  color: var(--color-on-surface);
  overflow-wrap: anywhere;
}

.field-row-end {
  display: flex;
  justify-content: flex-end;
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
  accent-color: var(--color-cta-bg);
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
  justify-content: center;
  font-family: var(--font-supporting);
  font-size: 0.875rem;
  font-weight: 500;
}

.text-link,
.links a {
  color: var(--color-link);
  text-underline-offset: 0.25rem;
}

.text-link:hover,
.links a:hover {
  text-decoration: underline;
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

ul {
  margin: 0 0 1.25rem;
  padding-left: 1.25rem;
  color: var(--color-on-surface-variant);
  font-family: var(--font-supporting);
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0;
  color: var(--color-on-surface-variant);
  font-family: var(--font-supporting);
  font-size: 0.75rem;
  letter-spacing: var(--label-tracking);
  text-transform: uppercase;
}

.auth-divider::before,
.auth-divider::after {
  content: "";
  flex: 1;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
}

.turnstile-slot {
  min-height: 0;
}

.btn:focus-visible,
.btn-reveal:focus-visible,
.field-input:focus-visible,
.text-link:focus-visible,
.skip-link:focus-visible,
a:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

.brand-logo {
  display: none;
  height: 2.75rem;
  width: auto;
}

html.theme-shop .brand-mark {
  display: none;
}

html.theme-shop .brand-logo,
html.theme-bid .brand-logo {
  display: block;
}

html.theme-shop .brand-sub,
html.theme-bid .brand-sub {
  display: none;
}

html.theme-bid .brand-logo {
  height: 3.5rem;
  max-width: min(100%, 12rem);
}

.product-back {
  margin: 0;
  width: min(100%, var(--auth-column, 528px));
}

.product-back .text-link {
  font-size: 0.875rem;
}

@media (max-width: 32rem) {
  .actions {
    grid-template-columns: 1fr;
  }

  main {
    padding: 2.5rem 1rem 4rem;
    gap: 2rem;
  }
}

@media (prefers-color-scheme: dark) {
  html.theme-shop .brand-logo {
    filter: brightness(0) invert(1);
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
