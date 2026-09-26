import type { HostedBrandProfile } from "./brand.js";
import type { HostedFieldKind } from "./browser/constraints.js";
import type { HostedAuthFlow } from "./flow-context.js";
import { productHintHref } from "./flow-context.js";
import { HOSTED_AUTH_ASSET_VERSION, HOSTED_AUTH_POLICY } from "./policy.js";
import { HOSTED_AUTH_TOKENS } from "./tokens.js";
import type { HostedAuthPageConfig } from "./view.js";

export { HOSTED_AUTH_STYLES } from "./styles.js";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Outfit:wght@400;500;600&display=swap";

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
};

export type HostedButtonOptions = {
  label: string;
  type?: "submit" | "button";
  kind?: "primary" | "secondary" | "link";
  id?: string;
  name?: string;
  value?: string;
  loadingLabel?: string;
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
    type === "password" ? 'autocapitalize="off" autocorrect="off" spellcheck="false"' : "",
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
  return `<button ${attrs}>${escapeHostedHtml(input.label)}</button>`;
}

export function authDivider(label = "or"): string {
  return `<p class="auth-divider"><span>${escapeHostedHtml(label)}</span></p>`;
}

export function statusRegions(): string {
  return `<p id="error" class="status-error" role="alert" aria-live="assertive" hidden></p>
    <p id="success" class="status-success" role="status" aria-live="polite" hidden></p>
    <p id="auth-announce" class="sr-only" aria-live="polite"></p>`;
}

export function turnstileHost(): string {
  return `<div id="turnstile-host" class="turnstile-slot" hidden></div>`;
}

export function continuationAnchor(label: string, path: string, flow: HostedAuthFlow): string {
  return `<a class="text-link" href="${escapeHostedHtml(productHintHref(path, flow))}">${escapeHostedHtml(label)}</a>`;
}

export function buildHostedAuthHtml(page: HostedAuthPage): string {
  const themeClass = `theme-${page.brand.theme}`;
  const logo = page.brand.logoSrc
    ? `<img class="brand-logo" src="${escapeHostedHtml(page.brand.logoSrc)}" alt="${escapeHostedHtml(page.brand.logoAlt ?? page.brand.productName)}" width="201" height="44">`
    : `<p class="brand-mark">${escapeHostedHtml(page.brand.productName)}</p>`;
  const asset = `?v=${HOSTED_AUTH_ASSET_VERSION}`;
  const productBack = page.productBack
    ? `<p class="product-back"><a class="text-link" href="${escapeHostedHtml(page.productBack.href)}">${escapeHostedHtml(page.productBack.label)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="en" class="${themeClass}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHostedHtml(page.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${FONT_HREF}">
  <link rel="stylesheet" href="/hosted-auth.css${asset}">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <main id="main-content">
    ${productBack}
    <div class="brand">
      ${logo}
      <p class="brand-sub">${escapeHostedHtml(HOSTED_AUTH_TOKENS.companyName)}</p>
    </div>
    <div class="heading">
      <h1>${escapeHostedHtml(page.title)}</h1>
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
