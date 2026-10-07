import { HOSTED_AUTH_POLICY } from "../policy.js";
import {
  type HostedLoginStep,
  announcementForLoginStep,
  focusTargetForLoginStep,
  nextLoginStep,
} from "./login-state.js";
import { submitEnabled } from "./turnstile.js";
import { asButton, hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const root = document.getElementById("login-root");
const form = document.getElementById("login-form");
const emailFirst = root?.getAttribute("data-email-first") === "true";
const cooldownMs = HOSTED_AUTH_POLICY.magicLinkCooldownMs;
let step: HostedLoginStep = emailFirst ? "email" : "credentials";
let cooldownUntil = 0;

function setStep(next: HostedLoginStep): void {
  if (!root) return;
  step = next;
  for (const node of root.querySelectorAll("[data-login-step]")) {
    if (node instanceof HTMLElement) {
      node.hidden = node.getAttribute("data-login-step") !== next;
    }
  }
  const methods = root.querySelector("[data-login-chrome=methods]");
  if (methods instanceof HTMLElement) methods.hidden = next === "magic-link-sent";
  const footer = root.querySelector("[data-login-chrome=footer]");
  if (footer instanceof HTMLElement) footer.hidden = next === "magic-link-sent";
  const summary = document.getElementById("email-summary-value");
  if (summary) summary.textContent = inputValue("email").trim();
  const confirmation = document.getElementById("magic-link-confirmation");
  if (confirmation && next === "magic-link-sent") {
    confirmation.textContent = `If we find an account for ${inputValue("email").trim()}, we'll email a secure sign-in link. Links expire in ${String(HOSTED_AUTH_POLICY.magicLinkExpiresMinutes)} minutes.`;
  }
  auth.announce(
    {
      email: announcementForLoginStep("email"),
      credentials: announcementForLoginStep("credentials"),
      "magic-link-sent": announcementForLoginStep("magic-link-sent"),
    }[next] || "",
  );
  const focusId = {
    email: focusTargetForLoginStep("email"),
    credentials: focusTargetForLoginStep("credentials"),
    "magic-link-sent": focusTargetForLoginStep("magic-link-sent"),
  }[next];
  window.setTimeout(() => auth.focusById(focusId), 0);
}

function bindCaptchaGate(button: HTMLButtonElement | null): void {
  auth.onTokenChange((token) => {
    if (!button || button.getAttribute("aria-busy") === "true") return;
    button.disabled = !submitEnabled({ captchaRequired: true, token });
  });
}

async function handleCaptcha(
  data: unknown,
  buttons: Array<HTMLButtonElement | null>,
): Promise<boolean> {
  if (!auth.isCaptchaRequired(data)) return false;
  for (const button of buttons) bindCaptchaGate(button);
  await auth.ensureTurnstile(buttons);
  auth.showError(auth.CAPTCHA_REQUIRED);
  return true;
}

async function signInEmail(submit: HTMLButtonElement | null): Promise<void> {
  if (!auth.validateFields(["email", "password"])) return;
  auth.hideStatus();
  auth.setBusy(submit, true);
  try {
    const { response, data } = await auth.postJson("/api/auth/sign-in/email", {
      email: inputValue("email").trim(),
      password: inputValue("password"),
    });
    if (await handleCaptcha(data, [submit])) return;
    if (!response.ok) {
      auth.showError(auth.GENERIC_SIGN_IN);
      return;
    }
    auth.continueAfterAuth(data);
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
}

async function sendMagicLink(button: HTMLButtonElement | null): Promise<void> {
  if (!auth.validateFields(["email"])) return;
  if (Date.now() < cooldownUntil) return;
  auth.hideStatus();
  auth.setBusy(button, true);
  try {
    const { data } = await auth.postJson("/api/auth/sign-in/magic-link", {
      email: inputValue("email").trim(),
      callbackURL: auth.productHintLoginUrl(),
    });
    if (await handleCaptcha(data, [button])) return;
    cooldownUntil = Date.now() + cooldownMs;
    setStep("magic-link-sent");
    auth.showSuccess(auth.GENERIC_MAGIC_LINK);
    const resend = asButton(document.getElementById("magic-link-resend"));
    if (resend) {
      auth.setBusy(resend, true);
      resend.textContent = "Wait 30s to resend";
      window.setTimeout(() => {
        resend.textContent = resend.dataset.label || "Resend sign-in link";
        auth.setBusy(resend, false);
      }, cooldownMs);
    }
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    if (button && button.id !== "magic-link-resend") auth.setBusy(button, false);
  }
}

if (form instanceof HTMLFormElement) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = submitButton(form, event);
    if (emailFirst && step === "email") {
      if (!auth.validateFields(["email"])) return;
      setStep(nextLoginStep("email", "continue-email"));
      return;
    }
    await signInEmail(submit);
  });
}

const changeEmail = document.getElementById("change-email");
if (changeEmail) {
  changeEmail.addEventListener("click", () => {
    auth.hideStatus();
    auth.clearTurnstileToken();
    setStep("email");
  });
}

const magicInstead = asButton(document.getElementById("magic-link-instead"));
if (magicInstead) {
  magicInstead.addEventListener("click", () => {
    void sendMagicLink(magicInstead);
  });
}

const magicResend = asButton(document.getElementById("magic-link-resend"));
if (magicResend) {
  magicResend.dataset.label = magicResend.textContent || "Resend sign-in link";
  magicResend.addEventListener("click", () => {
    void sendMagicLink(magicResend);
  });
}

const differentEmail = document.getElementById("different-email");
if (differentEmail) {
  differentEmail.addEventListener("click", () => {
    auth.hideStatus();
    setStep("email");
  });
}

for (const node of document.querySelectorAll("[data-social-provider]")) {
  const button = asButton(node);
  if (!button) continue;
  button.addEventListener("click", async () => {
    auth.hideStatus();
    auth.setBusy(button, true);
    try {
      const callbackURL = auth.productHintLoginUrl();
      const { response, data } = await auth.postJson("/api/auth/sign-in/social", {
        provider: button.getAttribute("data-social-provider"),
        callbackURL,
        errorCallbackURL: callbackURL,
      });
      if (!response.ok) {
        auth.showError(auth.GENERIC_NETWORK);
        return;
      }
      auth.continueAfterAuth(data);
    } catch {
      auth.showError(auth.GENERIC_NETWORK);
    } finally {
      auth.setBusy(button, false);
    }
  });
}
