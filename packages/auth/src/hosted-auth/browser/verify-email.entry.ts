import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { hostedAuth } from "./window-auth.js";

const auth = hostedAuth();
const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const pendingEl = document.getElementById("pending");

async function verifyToken(): Promise<void> {
  if (!token) return;
  if (pendingEl) pendingEl.hidden = false;
  try {
    const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      method: "GET",
      credentials: "same-origin",
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location && auth.isAllowedContinueUrl(location)) {
        window.location.assign(location);
        return;
      }
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      auth.showError(msg.VERIFY_FAILED);
      if (pendingEl) pendingEl.hidden = true;
      return;
    }
    auth.showSuccess("Email verified. Redirecting…");
    auth.continueAfterAuth(payload);
  } catch {
    if (pendingEl) pendingEl.hidden = true;
    auth.showError(auth.GENERIC_NETWORK);
  }
}

void verifyToken();
