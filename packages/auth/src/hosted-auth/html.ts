import type { HostedBrandProfile, HostedProductChip } from "./brand.js";
import type { HostedFieldKind } from "./browser/constraints.js";
import { HOSTED_COPY } from "./copy.js";
import { hostedFaviconLinkTags } from "./favicons.js";
import type { HostedAuthFlow } from "./flow-context.js";
import { productHintHref } from "./flow-context.js";
import {
  HOSTED_FONT_FILES,
  hostedFontPath,
  hostedLockupPath,
  hostedLockupWidth,
} from "./lockups.js";
import { HOSTED_AUTH_ASSET_VERSION, HOSTED_AUTH_POLICY } from "./policy.js";
import type { HostedAuthPageConfig } from "./view.js";

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

export function escapeHostedHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeJsonScript(json: string): string {
  return json.replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

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
  productBack?: { href: string; label: string };
};

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

export function floatingInput(input: FloatingInputOptions): string {
  const id = escapeHostedHtml(input.id);
  const errorId = `${id}-error`;
  const describedBy = [errorId, input.describedBy].filter(Boolean).join(" ");
  const type = inputType(input.type);
  const autocomplete = autocompleteValue(input.autocomplete);
  const inputmode = inputModeValue(input.inputmode);
  const name = input.name ?? input.id;
  const attrs = [
    attr("id", input.id),
    attr("name", name),
    attr("class", "field-input"),
    attr("type", type),
    'placeholder=" "',
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
      <div class="field-control">
        <input ${attrs}>
        <label class="field-label" for="${id}">${escapeHostedHtml(input.label)}</label>
      </div>
      <p id="${errorId}" class="field-error" role="alert" hidden></p>
    </div>`;
}

/** @deprecated Use floatingInput. Kept as a stable presenter alias. */
export const labeledInput = floatingInput;

export function passwordField(input: {
  id: string;
  label: string;
  autocomplete: "current-password" | "new-password";
  minlength?: number;
  maxlength?: number;
  required?: boolean;
}): string {
  const id = escapeHostedHtml(input.id);
  const errorId = `${id}-error`;
  const minlength = input.minlength ?? 0;
  const maxlength = input.maxlength ?? HOSTED_AUTH_POLICY.passwordMaxLength;
  const kind: HostedFieldKind = input.autocomplete === "new-password" ? "new-password" : "password";
  const attrs = [
    attr("id", input.id),
    attr("name", input.id),
    attr("class", "field-input"),
    'type="password"',
    'placeholder=" "',
    attr("autocomplete", input.autocomplete),
    attr("aria-describedby", errorId),
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
      <div class="field-control field-control-password">
        <input ${attrs}>
        <label class="field-label" for="${id}">${escapeHostedHtml(input.label)}</label>
        <button type="button" class="btn-reveal" data-password-toggle="${id}" aria-label="Show password" aria-pressed="false">Show</button>
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

const ACCOUNT_LOCKUP_HEIGHT = 44;
const ACCOUNT_LOCKUP_WIDTH = hostedLockupWidth(ACCOUNT_LOCKUP_HEIGHT);

function accountLockupPicture(assetSuffix: string): string {
  const light = escapeHostedHtml(`${hostedLockupPath("light")}${assetSuffix}`);
  const dark = escapeHostedHtml(`${hostedLockupPath("dark")}${assetSuffix}`);
  return `<picture>
      <source srcset="${dark}" media="(prefers-color-scheme: dark)">
      <img class="brand-logo" src="${light}" alt="${escapeHostedHtml(HOSTED_COPY.accountName)}" width="${ACCOUNT_LOCKUP_WIDTH}" height="${ACCOUNT_LOCKUP_HEIGHT}">
    </picture>`;
}

function productChipMarkup(chip: HostedProductChip | null): string {
  if (!chip) return "";
  return `<p class="product-chip">${escapeHostedHtml(HOSTED_COPY.continueTo)} <strong>${escapeHostedHtml(chip.label)}</strong></p>`;
}

function productName(product: "bid" | "shop" | "art", label: string): string {
  return `<span class="product-name product-name--${product}">${escapeHostedHtml(label)}</span>`;
}

/** "One LAX Account for LAX Bid, LAX Shop and lax.art.", each product named in its own colour. */
function oneAccountMarkup(): string {
  const { bid, shop, art } = HOSTED_COPY.oneAccountProducts;
  return `One LAX Account for ${productName("bid", bid)}, ${productName("shop", shop)} and ${productName("art", art)}.`;
}

/** The promise that one sign-in covers every LAX product, with a way to read more when Account is configured. */
export function oneAccountNote(accountOrigin: string | undefined): string {
  const learnMore = accountOrigin
    ? ` <a class="text-link" href="${escapeHostedHtml(accountOrigin.replace(/\/$/, ""))}/">${escapeHostedHtml(HOSTED_COPY.learnMore)}</a>`
    : "";
  return `<p class="one-account">${oneAccountMarkup()}${learnMore}</p>`;
}

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
  // Every hosted page is the LAX Account, whichever product the user came from.
  const logo = accountLockupPicture(asset);
  const brandTagline = page.brand.tagline
    ? `<p class="brand-tagline">${escapeHostedHtml(page.brand.tagline)}</p>`
    : "";
  const documentTitle = `${page.title} · ${HOSTED_COPY.accountName}`;
  const productBack = page.productBack
    ? `<p class="product-back"><a class="product-back-link" href="${escapeHostedHtml(page.productBack.href)}">${PRODUCT_BACK_CHEVRON}<span>${escapeHostedHtml(page.productBack.label)}</span></a></p>`
    : "";
  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHostedHtml(documentTitle)}</title>
${hostedFaviconLinkTags()}
${fontPreloadTags()}
  <link rel="stylesheet" href="/hosted-auth.css${asset}">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <main id="main-content">
    ${productBack}
    <div class="brand">
      ${logo}
      ${brandTagline}
    </div>
    <div class="heading">
      <h1>${escapeHostedHtml(page.title)}</h1>
      ${productChipMarkup(page.brand.chip)}
      ${page.description ? `<p class="lead">${escapeHostedHtml(page.description)}</p>` : ""}
    </div>
    <div class="panel">${page.body}</div>
    <noscript><p class="lead">Enable JavaScript to continue signing in.</p></noscript>
  </main>
  <script type="application/json" id="hosted-auth-config">${escapeJsonScript(JSON.stringify(page.config))}</script>
  <script src="/hosted-auth-runtime.js${asset}" defer></script>
  ${page.scriptSrc ? `<script src="${escapeHostedHtml(page.scriptSrc)}${asset}" defer></script>` : ""}
</body>
</html>`;
}
