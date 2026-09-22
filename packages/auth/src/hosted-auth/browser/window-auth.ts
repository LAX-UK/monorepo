import type { HostedAuthConfig, JsonResponse } from "./api.js";

export type HostedAuthApi = {
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

export function hostedAuth(): HostedAuthApi {
  return (window as unknown as { HostedAuth: HostedAuthApi }).HostedAuth;
}

export function inputValue(id: string): string {
  const el = document.getElementById(id);
  return el instanceof HTMLInputElement ? el.value : "";
}

export function submitButton(form: HTMLFormElement, event?: SubmitEvent): HTMLButtonElement | null {
  if (event?.submitter instanceof HTMLButtonElement) return event.submitter;
  const fallback = form.querySelector("[type=submit]");
  return fallback instanceof HTMLButtonElement ? fallback : null;
}

export function asButton(node: Element | null): HTMLButtonElement | null {
  return node instanceof HTMLButtonElement ? node : null;
}
