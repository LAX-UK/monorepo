import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();

function trustDevice(): boolean {
  const input = document.getElementById("trust-device");
  return input instanceof HTMLInputElement ? input.checked : false;
}

async function submit(
  endpoint: string,
  body: unknown,
  button: HTMLButtonElement | null,
  fields: string[],
): Promise<void> {
  if (!auth.validateFields(fields)) return;
  auth.hideStatus();
  auth.setBusy(button, true);
  try {
    const { response, data } = await auth.postJson(endpoint, body);
    if (!response.ok) {
      auth.showError(msg.MFA_FAILED);
      return;
    }
    auth.continueAfterAuth(data);
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(button, false);
  }
}

const totpForm = document.getElementById("totp-form");
if (totpForm instanceof HTMLFormElement) {
  totpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submit(
      "/api/auth/two-factor/verify-totp",
      {
        code: inputValue("totp-code").trim(),
        trustDevice: trustDevice(),
      },
      submitButton(totpForm, event),
      ["totp-code"],
    );
  });
}

const backupForm = document.getElementById("backup-form");
if (backupForm instanceof HTMLFormElement) {
  backupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submit(
      "/api/auth/two-factor/verify-backup-code",
      {
        code: inputValue("backup-code").trim(),
        trustDevice: trustDevice(),
      },
      submitButton(backupForm, event),
      ["backup-code"],
    );
  });
}
