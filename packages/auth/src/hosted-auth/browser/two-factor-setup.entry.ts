import QRCode from "qrcode";
import { formatManualKey } from "./manual-key.js";
import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();

let backupCodes: string[] = [];

function errorCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function fieldError(id: string, message: string): void {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    auth.showError(message);
    return;
  }
  auth.applyFieldError(input, message);
  auth.announce(message);
  input.select();
  auth.focusById(id);
}

async function renderQrFromUri(totpUri: string): Promise<void> {
  const qrHost = document.getElementById("setup-qr");
  const secretEl = document.getElementById("setup-secret");
  if (!qrHost || !secretEl) return;
  const secret = new URL(totpUri).searchParams.get("secret") ?? "";
  secretEl.textContent = secret ? `Manual key: ${formatManualKey(secret)}` : "";
  try {
    qrHost.innerHTML = await QRCode.toString(totpUri, {
      type: "svg",
      margin: 1,
      width: 180,
      color: { dark: "#000000", light: "#ffffff" },
    });
  } catch {
    qrHost.textContent = "Enter the manual key below in your authenticator app.";
  }
}

function showEnrolment(): void {
  const start = document.getElementById("setup-start");
  const enrol = document.getElementById("setup-enrol");
  if (start) start.hidden = true;
  if (enrol) enrol.hidden = false;
  auth.focusById("setup-totp-code");
}

async function enableTotp(button: HTMLButtonElement | null): Promise<void> {
  auth.hideStatus();
  auth.setBusy(button, true);
  try {
    const password = inputValue("setup-password");
    const { response, data } = await auth.postJson(
      "/api/auth/two-factor/enable",
      password.length > 0 ? { password } : {},
    );
    if (response.status === 401) {
      auth.showError(msg.MFA_SESSION_EXPIRED);
      return;
    }
    if (!response.ok) {
      if (errorCode(data) === "INVALID_PASSWORD") {
        fieldError("setup-password", msg.MFA_PASSWORD_INCORRECT);
        return;
      }
      auth.showError(msg.MFA_FAILED);
      return;
    }
    const payload = (data ?? {}) as Record<string, unknown>;
    const totpURI = typeof payload.totpURI === "string" ? payload.totpURI : "";
    if (!totpURI) {
      auth.showError(msg.MFA_FAILED);
      return;
    }
    backupCodes = Array.isArray(payload.backupCodes)
      ? payload.backupCodes.filter((c): c is string => typeof c === "string")
      : [];
    await renderQrFromUri(totpURI);
    showEnrolment();
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(button, false);
  }
}

const startForm = document.getElementById("setup-start");
if (startForm instanceof HTMLFormElement) {
  startForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await enableTotp(submitButton(startForm, event));
  });
}

function showBackupCodes(verifyForm: HTMLFormElement): boolean {
  const backupBlock = document.getElementById("setup-backup");
  const list = document.getElementById("setup-backup-list");
  if (!backupBlock || !list || backupCodes.length === 0) return false;
  list.textContent = backupCodes.join("\n");
  backupBlock.hidden = false;
  verifyForm.hidden = true;
  for (const id of ["setup-qr", "setup-secret"]) {
    const node = document.getElementById(id);
    if (node) node.hidden = true;
  }
  auth.announce(msg.MFA_ENABLED);
  auth.focusById("setup-finish-btn");
  return true;
}

const verifyForm = document.getElementById("setup-verify-form");
if (verifyForm instanceof HTMLFormElement) {
  verifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = submitButton(verifyForm, event);
    if (!auth.validateFields(["setup-totp-code"])) return;
    auth.hideStatus();
    auth.setBusy(btn, true);
    try {
      const { response, data } = await auth.postJson("/api/auth/two-factor/verify-totp", {
        code: inputValue("setup-totp-code").trim(),
      });
      if (response.status === 401) {
        auth.showError(msg.MFA_SESSION_EXPIRED);
        return;
      }
      if (!response.ok) {
        fieldError("setup-totp-code", msg.MFA_CODE_INVALID);
        return;
      }
      if (!showBackupCodes(verifyForm)) auth.continueAfterAuth(data);
    } catch {
      auth.showError(auth.GENERIC_NETWORK);
    } finally {
      auth.setBusy(btn, false);
    }
  });
}

const copyBtn = document.getElementById("setup-copy-btn");
if (copyBtn instanceof HTMLButtonElement) {
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      auth.showSuccess(msg.MFA_CODES_COPIED);
    } catch {
      auth.showError(msg.MFA_CODES_COPY_FAILED);
    }
  });
}

const finishBtn = document.getElementById("setup-finish-btn");
if (finishBtn instanceof HTMLButtonElement) {
  finishBtn.addEventListener("click", () => {
    auth.continueAfterAuth(null);
  });
}
