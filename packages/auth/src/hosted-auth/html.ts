import type { HostedBrandProfile } from "./brand.js";
import type { HostedFieldKind } from "./browser/constraints.js";
import { destinationLine, hostedFooter, hostedHeader } from "./chrome.js";
import { HOSTED_COPY } from "./copy.js";
import { escapeHostedHtml, escapeJsonScript } from "./escape.js";
import { hostedFaviconLinkTags } from "./favicons.js";
import type { HostedAuthFlow } from "./flow-context.js";
import { productHintHref } from "./flow-context.js";
import { type HostedFooterLinks, hostedFooterLinks } from "./legal-links.js";
import { HOSTED_FONT_FILES, hostedFontPath } from "./lockups.js";
import { HOSTED_AUTH_ASSET_VERSION, HOSTED_AUTH_POLICY } from "./policy.js";
import type { HostedAuthPageConfig, HostedAuthView } from "./view.js";

export { HOSTED_AUTH_STYLES } from "./styles.js";

const ALLOWED_INPUT_TYPES = new Set(["text", "email", "tel", "password", "search"]);
const ALLOWED_AUTOCOMPLETE = new Set([
  "name",
  "username",
  "email",
  "tel",
  "current-password",
  "new-password",
  "one-time-code",
  "off",
]);
const ALLOWED_INPUTMODE = new Set(["text", "email", "tel", "numeric"]);

export { escapeHostedHtml, escapeJsonScript };

function attr(name: string, value: string): string {
  return `${name}="${escapeHostedHtml(value)}"`;
}

export type HostedAuthPage = {
  title: string;
  description?: string;
  body: string;
  scriptSrc?: string;
  brand: HostedBrandProfile;
  config: HostedAuthPageConfig;
  /** LAX Account's privacy and help links; left out where the product origins are unknown. */
  footer?: HostedFooterLinks;
  /** "to continue to LAX Bid" under the heading. Off for error pages, which go nowhere yet. */
  showDestination?: boolean;
  productBack?: { href: string; label: string };
};

/** What every page takes from its view: brand, client config and footer links. */
export function viewChrome(
  view: HostedAuthView,
): Pick<HostedAuthPage, "brand" | "config" | "footer"> {
  return { brand: view.brand, config: view.config, footer: hostedFooterLinks(view.capabilities) };
}

export type FloatingInputOptions = {
  id: string;
  label: string;
  type?: "text" | "email" | "tel" | "password" | "search";
  autocomplete?: string;
  required?: boolean;
  minlength?: number;
  maxlength?: number;
  inputmode?: "text" | "email" | "tel" | "numeric";
  pattern?: string;
  name?: string;
  describedBy?: string;
  kind?: HostedFieldKind;
  /** Codes and keys that must reach the server exactly as typed: no auto-capitalise, correct or spellcheck. */
  exactEntry?: boolean;
  /** Guidance shown under the label before anything is typed. */
  hint?: string;
};

export type HostedButtonOptions = {
  label: string;
  type?: "submit" | "button";
  kind?: "primary" | "secondary" | "link";
  id?: string;
  name?: string;
  value?: string;
  loadingLabel?: string;
  /** Trusted inline SVG/HTML placed before the visible label. */
  leadingMark?: string;
  extraAttrs?: Readonly<Record<string, string>>;
};

function extraAttrName(name: string): string | null {
  if (/^(data|aria)-[a-z0-9-]+$/.test(name)) return name;
  return null;
}

function inputType(value: string | undefined): string {
  return value && ALLOWED_INPUT_TYPES.has(value) ? value : "text";
}

function autocompleteValue(value: string | undefined): string | null {
  if (!value || !ALLOWED_AUTOCOMPLETE.has(value)) return null;
  return value;
}

function inputModeValue(value: string | undefined): string | null {
  if (!value || !ALLOWED_INPUTMODE.has(value)) return null;
  return value;
}

function inferFieldKind(input: FloatingInputOptions): HostedFieldKind {
  if (input.kind) return input.kind;
  if (input.type === "email") return "email";
  if (input.type === "tel") return "phone";
  if (input.inputmode === "numeric") return "otp";
  if (input.autocomplete === "name") return "name";
  return "text";
}

function fieldHint(id: string, hint: string | undefined): { html: string; id: string | null } {
  if (!hint) return { html: "", id: null };
  const hintId = `${id}-hint`;
  return { html: `<p id="${hintId}" class="field-hint">${escapeHostedHtml(hint)}</p>`, id: hintId };
}

/**
 * A labelled text field in LAX Account's field style: the label above a 44px box with a 3:1 edge,
 * a hint under the label when there is one, and the error under the box.
 */
export function floatingInput(input: FloatingInputOptions): string {
  const id = escapeHostedHtml(input.id);
  const errorId = `${id}-error`;
  const hint = fieldHint(id, input.hint);
  const describedBy = [errorId, hint.id, input.describedBy].filter(Boolean).join(" ");
  const type = inputType(input.type);
  const autocomplete = autocompleteValue(input.autocomplete);
  const inputmode = inputModeValue(input.inputmode);
  const name = input.name ?? input.id;
  const attrs = [
    attr("id", input.id),
    attr("name", name),
    attr("class", "field-input"),
    attr("type", type),
    attr("aria-describedby", describedBy),
    'aria-invalid="false"',
    attr("data-field-kind", inferFieldKind(input)),
    input.required === false ? "" : "required",
    autocomplete ? attr("autocomplete", autocomplete) : "",
    input.minlength ? attr("minlength", String(input.minlength)) : "",
    input.maxlength ? attr("maxlength", String(input.maxlength)) : "",
    inputmode ? attr("inputmode", inputmode) : "",
    input.pattern ? attr("pattern", input.pattern) : "",
    type === "email" ? attr("spellcheck", "false") : "",
    type === "password" || input.exactEntry
      ? 'autocapitalize="off" autocorrect="off" spellcheck="false"'
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<div class="field">
      <label class="field-label" for="${id}">${escapeHostedHtml(input.label)}</label>
      ${hint.html}
      <div class="field-control">
        <input ${attrs}>
      </div>
      <p id="${errorId}" class="field-error" role="alert" hidden></p>
    </div>`;
}

/** @deprecated Use floatingInput. Kept as a stable presenter alias. */
export const labeledInput = floatingInput;

/** Lucide's eye and eye-off: the reveal button shows the one for what pressing it does. */
const EYE_ICON = `<svg class="reveal-icon reveal-icon--show" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_ICON = `<svg class="reveal-icon reveal-icon--hide" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`;

/** What the issuer asks of a new password, said before anyone types one. */
export function newPasswordHint(minLength: number = HOSTED_AUTH_POLICY.passwordMinLength): string {
  return `Use at least ${minLength} characters. Passwords found in known data breaches can't be used.`;
}

/**
 * A password field with a reveal toggle. The toggle keeps one name ("Show password") and reports
 * its state through `aria-pressed`, which the runtime flips; the icon follows the state.
 */
export function passwordField(input: {
  id: string;
  label: string;
  autocomplete: "current-password" | "new-password";
  minlength?: number;
  maxlength?: number;
  required?: boolean;
  hint?: string;
}): string {
  const id = escapeHostedHtml(input.id);
  const errorId = `${id}-error`;
  const hint = fieldHint(id, input.hint);
  const minlength = input.minlength ?? 0;
  const maxlength = input.maxlength ?? HOSTED_AUTH_POLICY.passwordMaxLength;
  const kind: HostedFieldKind = input.autocomplete === "new-password" ? "new-password" : "password";
  const attrs = [
    attr("id", input.id),
    attr("name", input.id),
    attr("class", "field-input"),
    'type="password"',
    attr("autocomplete", input.autocomplete),
    attr("aria-describedby", [errorId, hint.id].filter(Boolean).join(" ")),
    'aria-invalid="false"',
    attr("data-field-kind", kind),
    'autocapitalize="off"',
    'autocorrect="off"',
    'spellcheck="false"',
    input.required === false ? "" : "required",
    minlength > 0 ? attr("minlength", String(minlength)) : "",
    attr("maxlength", String(maxlength)),
  ]
    .filter(Boolean)
    .join(" ");
  return `<div class="field">
      <label class="field-label" for="${id}">${escapeHostedHtml(input.label)}</label>
      ${hint.html}
      <div class="field-control field-control-password">
        <input ${attrs}>
        <button type="button" class="btn-reveal" data-password-toggle="${id}" aria-label="Show password" aria-pressed="false">${EYE_ICON}${EYE_OFF_ICON}</button>
      </div>
      <p id="${errorId}" class="field-error" role="alert" hidden></p>
    </div>`;
}

export function hostedButton(input: HostedButtonOptions): string {
  const kind = input.kind ?? "primary";
  const attrs = [
    attr("type", input.type ?? "submit"),
    attr("class", `btn btn-${kind}`),
    input.id ? attr("id", input.id) : "",
    input.name ? attr("name", input.name) : "",
    input.value ? attr("value", input.value) : "",
    input.loadingLabel ? attr("data-loading-label", input.loadingLabel) : "",
    ...Object.entries(input.extraAttrs ?? {}).flatMap(([name, value]) => {
      const safeName = extraAttrName(name);
      return safeName ? [attr(safeName, value)] : [];
    }),
  ]
    .filter(Boolean)
    .join(" ");
  const labelHtml = input.leadingMark
    ? `${input.leadingMark}<span class="btn-label">${escapeHostedHtml(input.label)}</span>`
    : escapeHostedHtml(input.label);
  return `<button ${attrs}>${labelHtml}</button>`;
}

export function authDivider(label = "or"): string {
  return `<p class="auth-divider"><span>${escapeHostedHtml(label)}</span></p>`;
}

export function statusRegions(): string {
  return `<p id="error" class="status-error" role="alert" aria-live="assertive" tabindex="-1" hidden></p>
    <p id="success" class="status-success" role="status" aria-live="polite" hidden></p>
    <p id="auth-announce" class="sr-only" aria-live="polite"></p>`;
}

export function turnstileHost(): string {
  return `<div id="turnstile-host" class="turnstile-slot" hidden></div>`;
}

export function continuationAnchor(label: string, path: string, flow: HostedAuthFlow): string {
  return `<a class="text-link" href="${escapeHostedHtml(productHintHref(path, flow))}">${escapeHostedHtml(label)}</a>`;
}

const PRODUCT_BACK_CHEVRON = `<svg class="product-back-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 12L6 8l4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Only Montserrat is preloaded: every hosted page sets its text in it, as LAX Account does. */
function fontPreloadTags(): string {
  return [HOSTED_FONT_FILES.montserrat]
    .map(
      (file) =>
        `  <link rel="preload" href="${hostedFontPath(file)}?v=${HOSTED_AUTH_ASSET_VERSION}" as="font" type="font/woff2" crossorigin>`,
    )
    .join("\n");
}

export function buildHostedAuthHtml(page: HostedAuthPage): string {
  const asset = `?v=${HOSTED_AUTH_ASSET_VERSION}`;
  const documentTitle = `${page.title} · ${HOSTED_COPY.accountName}`;
  const productBack = page.productBack
    ? `<p class="product-back"><a class="product-back-link" href="${escapeHostedHtml(page.productBack.href)}">${PRODUCT_BACK_CHEVRON}<span>${escapeHostedHtml(page.productBack.label)}</span></a></p>`
    : "";
  const destination = page.showDestination === false ? "" : destinationLine(page.brand.chip);
  // Every hosted page is the LAX Account, whichever product the person came from. The theme
  // script has no `defer`: it sets the theme class before the first paint.
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHostedHtml(documentTitle)}</title>
${hostedFaviconLinkTags()}
${fontPreloadTags()}
  <link rel="stylesheet" href="/hosted-auth.css${asset}">
  <script src="/hosted-theme.js${asset}"></script>
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="auth-split">
    <div class="auth-panel">
      ${hostedHeader({ assetSuffix: asset, tagline: page.brand.tagline })}
      <main id="main-content" class="auth-main">
        <div class="auth-column">
          ${productBack}
          <div class="heading">
            <h1>${escapeHostedHtml(page.title)}</h1>
            ${destination}
            ${page.description ? `<p class="lead">${escapeHostedHtml(page.description)}</p>` : ""}
          </div>
          <div class="panel">${page.body}</div>
          <noscript><p class="lead">Enable JavaScript to continue signing in.</p></noscript>
        </div>
      </main>
      ${hostedFooter(page.footer ?? null, new Date().getFullYear())}
    </div>
    <div class="auth-art" aria-hidden="true"></div>
  </div>
  <script type="application/json" id="hosted-auth-config">${escapeJsonScript(JSON.stringify(page.config))}</script>
  <script src="/hosted-auth-runtime.js${asset}" defer></script>
  ${page.scriptSrc ? `<script src="${escapeHostedHtml(page.scriptSrc)}${asset}" defer></script>` : ""}
</body>
</html>`;
}
