import type { HostedAuthConfig, JsonResponse } from "./api.js";
import { messageForValidityState, parseFieldKind } from "./constraints.js";
import {
  type ContinuePayload,
  isAllowedContinueUrl,
  productHintLoginUrl,
  resolveContinueUrl,
} from "./continue.js";
import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { isCaptchaRequiredPayload, submitEnabled } from "./turnstile.js";

type HostedAuthApi = {
  config: HostedAuthConfig;
  postJson(path: string, body: unknown): Promise<JsonResponse>;
  setBusy(button: HTMLButtonElement | null, busy: boolean): void;
  showError(message: string): void;
  showSuccess(message: string): void;
  hideStatus(): void;
  announce(message: string): void;
  continueAfterAuth(payload: unknown): void;
  restartProduct(): void;
  isAllowedContinueUrl(raw: string): boolean;
  productHintLoginUrl(): string;
  isCaptchaRequired(data: unknown): boolean;
  validateFields(ids: string[]): boolean;
  applyFieldError(input: HTMLInputElement, message: string): void;
  clearFieldError(input: HTMLInputElement): void;
  bindFieldConstraints(root?: ParentNode | null): void;
  focusById(id: string): void;
  ensureTurnstile(buttons?: Array<HTMLButtonElement | null>): Promise<boolean>;
  clearTurnstileToken(): void;
  onTokenChange(listener: (token: string) => void): () => void;
  GENERIC_SIGN_IN: string;
  GENERIC_REGISTER: string;
  GENERIC_NETWORK: string;
  GENERIC_RECOVERY: string;
  GENERIC_OTP_SEND: string;
  GENERIC_OTP_VERIFY: string;
  GENERIC_MAGIC_LINK: string;
  GENERIC_VERIFICATION: string;
  REGISTER_CHECK_EMAIL: string;
  CAPTCHA_REQUIRED: string;
};

type HostedAuthGlobals = {
  HostedAuth: HostedAuthApi;
  __turnstileToken?: string;
  __turnstileWidgetId?: string | number;
  __turnstileLoader?: Promise<void>;
  turnstile?: {
    render(host: HTMLElement, options: Record<string, unknown>): string | number;
    reset(id: string | number): void;
  };
};

function globals(): Window & HostedAuthGlobals {
  return window as unknown as Window & HostedAuthGlobals;
}

function parseConfig(): HostedAuthConfig {
  const configEl = document.getElementById("hosted-auth-config");
  try {
    return configEl
      ? (JSON.parse(configEl.textContent || "{}") as HostedAuthConfig)
      : ({} as HostedAuthConfig);
  } catch {
    return {} as HostedAuthConfig;
  }
}

export function installHostedAuthRuntime(): HostedAuthApi {
  const g = globals();
  const config = parseConfig();
  const errorEl = document.getElementById("error");
  const successEl = document.getElementById("success");
  const announceEl = document.getElementById("auth-announce");
  const origin = window.location.origin;
  const allowed = Array.isArray(config.allowedRedirectOrigins) ? config.allowedRedirectOrigins : [];
  let captchaRequired = false;
  const gatedButtons = new Set<HTMLButtonElement>();
  const tokenListeners = new Set<(token: string) => void>();

  function currentToken(): string {
    return g.__turnstileToken ?? "";
  }

  function emitToken(token: string): void {
    g.__turnstileToken = token;
    for (const listener of tokenListeners) listener(token);
    syncCaptchaGates();
  }

  function onTokenChange(listener: (token: string) => void): () => void {
    tokenListeners.add(listener);
    return () => {
      tokenListeners.delete(listener);
    };
  }

  function syncCaptchaGates(): void {
    const enabled = submitEnabled({
      captchaRequired,
      token: currentToken(),
    });
    for (const button of gatedButtons) {
      if (button.getAttribute("aria-busy") === "true") continue;
      button.disabled = !enabled;
    }
  }

  function isAllowed(raw: string): boolean {
    return isAllowedContinueUrl(raw, origin, allowed);
  }

  function hintLoginUrl(): string {
    return productHintLoginUrl(origin, config.loginPath || "/login");
  }

  function continueAfterAuth(payload: unknown): void {
    window.location.assign(
      resolveContinueUrl(payload as ContinuePayload, origin, {
        twoFactorPath: config.twoFactorPath,
        authorizeResumePath: config.authorizeResumePath,
        restartUrl: config.restartUrl,
        loginPath: config.loginPath,
        allowedRedirectOrigins: allowed,
      }),
    );
  }

  function restartProduct(): void {
    window.location.assign(config.restartUrl || hintLoginUrl());
  }

  async function postJson(
    path: string,
    body: unknown,
  ): Promise<{ response: Response; data: unknown }> {
    const token = g.__turnstileToken;
    const payload =
      token && typeof body === "object" && body !== null
        ? { ...(body as Record<string, unknown>), turnstileToken: token }
        : body;
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    return { response, data };
  }

  function setBusy(button: HTMLButtonElement | null, busy: boolean): void {
    if (!button) return;
    button.setAttribute("aria-busy", busy ? "true" : "false");
    const loading = button.getAttribute("data-loading-label");
    if (loading) {
      if (busy) {
        if (!button.dataset.label) button.dataset.label = button.textContent || "";
        button.textContent = loading;
      } else if (button.dataset.label) {
        button.textContent = button.dataset.label;
      }
    }
    if (busy) {
      button.disabled = true;
      return;
    }
    if (captchaRequired && gatedButtons.has(button)) {
      button.disabled = !submitEnabled({ captchaRequired: true, token: currentToken() });
      return;
    }
    button.disabled = false;
  }

  function showError(message: string): void {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
    if (successEl) successEl.hidden = true;
  }

  function showSuccess(message: string): void {
    if (!successEl) return;
    successEl.textContent = message;
    successEl.hidden = false;
    if (errorEl) errorEl.hidden = true;
  }

  function hideStatus(): void {
    if (errorEl) errorEl.hidden = true;
    if (successEl) successEl.hidden = true;
  }

  function announce(message: string): void {
    if (!announceEl) return;
    announceEl.textContent = message;
  }

  function fieldControl(input: HTMLElement): HTMLElement | null {
    return input.closest(".field-control");
  }

  function fieldErrorEl(input: HTMLElement): HTMLElement | null {
    return document.getElementById(`${input.id}-error`);
  }

  function messageForValidity(input: HTMLInputElement): string {
    return messageForValidityState(
      parseFieldKind(input.getAttribute("data-field-kind")),
      input.validity,
      {
        minLength: input.minLength,
        maxLength: input.maxLength,
        validationMessage: input.validationMessage,
      },
    );
  }

  function applyFieldError(input: HTMLInputElement, message: string): void {
    input.setAttribute("aria-invalid", "true");
    fieldControl(input)?.classList.add("is-invalid");
    const error = fieldErrorEl(input);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function clearFieldError(input: HTMLInputElement): void {
    input.setAttribute("aria-invalid", "false");
    fieldControl(input)?.classList.remove("is-invalid");
    const error = fieldErrorEl(input);
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  }

  function validateFields(ids: string[]): boolean {
    let firstInvalid: HTMLInputElement | null = null;
    for (const id of ids) {
      const input = document.getElementById(id);
      if (!(input instanceof HTMLInputElement)) continue;
      if (!input.checkValidity()) {
        applyFieldError(input, messageForValidity(input));
        firstInvalid ??= input;
      } else {
        clearFieldError(input);
      }
    }
    firstInvalid?.focus();
    return !firstInvalid;
  }

  function bindFieldConstraints(root?: ParentNode | null): void {
    const scope = root ?? document;
    for (const node of scope.querySelectorAll(".field-input")) {
      if (!(node instanceof HTMLInputElement)) continue;
      const input = node;
      input.addEventListener("invalid", (event) => {
        event.preventDefault();
        applyFieldError(input, messageForValidity(input));
      });
      input.addEventListener("input", () => {
        if (input.validity.valid) clearFieldError(input);
      });
    }
  }

  function focusById(id: string): void {
    document.getElementById(id)?.focus();
  }

  function clearTurnstileToken(): void {
    const widgetId = g.__turnstileWidgetId;
    if (g.turnstile && widgetId !== undefined) {
      try {
        g.turnstile.reset(widgetId);
      } catch {
        // ignore
      }
    }
    emitToken("");
  }

  function loadTurnstileScript(): Promise<void> {
    if (g.turnstile) return Promise.resolve();
    if (g.__turnstileLoader) return g.__turnstileLoader;
    g.__turnstileLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("turnstile"));
      document.head.appendChild(script);
    });
    return g.__turnstileLoader;
  }

  async function ensureTurnstile(buttons: Array<HTMLButtonElement | null> = []): Promise<boolean> {
    const siteKey = config.turnstileSiteKey;
    const host = document.getElementById("turnstile-host");
    if (!siteKey || !host) return false;
    captchaRequired = true;
    for (const button of buttons) {
      if (button) gatedButtons.add(button);
    }
    host.hidden = false;
    await loadTurnstileScript();
    if (g.__turnstileWidgetId !== undefined) {
      clearTurnstileToken();
      return true;
    }
    emitToken("");
    const widgetId = g.turnstile?.render(host, {
      sitekey: siteKey,
      callback: (token: string) => {
        emitToken(token);
      },
      "expired-callback": () => {
        emitToken("");
      },
      "error-callback": () => {
        emitToken("");
      },
    });
    if (widgetId !== undefined) g.__turnstileWidgetId = widgetId;
    syncCaptchaGates();
    return true;
  }

  for (const node of document.querySelectorAll("[data-password-toggle]")) {
    node.addEventListener("click", () => {
      const id = node.getAttribute("data-password-toggle");
      const input = id ? document.getElementById(id) : null;
      if (!input) return;
      const next = input.getAttribute("type") === "password" ? "text" : "password";
      input.setAttribute("type", next);
      const hidden = next === "password";
      node.setAttribute("aria-label", hidden ? "Show password" : "Hide password");
      node.setAttribute("aria-pressed", hidden ? "false" : "true");
      node.textContent = hidden ? "Show" : "Hide";
    });
  }

  bindFieldConstraints(document);

  const api: HostedAuthApi = {
    config,
    postJson,
    setBusy,
    showError,
    showSuccess,
    hideStatus,
    announce,
    continueAfterAuth,
    restartProduct,
    isAllowedContinueUrl: isAllowed,
    productHintLoginUrl: hintLoginUrl,
    isCaptchaRequired: isCaptchaRequiredPayload,
    validateFields,
    applyFieldError,
    clearFieldError,
    bindFieldConstraints,
    focusById,
    ensureTurnstile,
    clearTurnstileToken,
    onTokenChange,
    GENERIC_SIGN_IN: msg.GENERIC_SIGN_IN,
    GENERIC_REGISTER: msg.GENERIC_REGISTER,
    GENERIC_NETWORK: msg.GENERIC_NETWORK,
    GENERIC_RECOVERY: msg.GENERIC_RECOVERY,
    GENERIC_OTP_SEND: msg.GENERIC_OTP_SEND,
    GENERIC_OTP_VERIFY: msg.GENERIC_OTP_VERIFY,
    GENERIC_MAGIC_LINK: msg.GENERIC_MAGIC_LINK,
    GENERIC_VERIFICATION: msg.GENERIC_VERIFICATION,
    REGISTER_CHECK_EMAIL: msg.REGISTER_CHECK_EMAIL,
    CAPTCHA_REQUIRED: msg.CAPTCHA_REQUIRED,
  };
  g.HostedAuth = api;
  return api;
}
