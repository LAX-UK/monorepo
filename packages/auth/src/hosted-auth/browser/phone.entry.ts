import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const sendForm = document.getElementById("phone-send-form");
const verifyForm = document.getElementById("phone-verify-form");
if (!(sendForm instanceof HTMLFormElement) || !(verifyForm instanceof HTMLFormElement)) {
  throw new Error("hosted phone forms missing");
}

sendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.validateFields(["phone"])) return;
  auth.hideStatus();
  const submit = submitButton(sendForm, event);
  auth.setBusy(submit, true);
  try {
    await auth.postJson("/api/auth/phone-number/send-otp", {
      phoneNumber: inputValue("phone").trim(),
    });
    auth.showSuccess(auth.GENERIC_OTP_SEND);
    verifyForm.hidden = false;
    auth.focusById("otp");
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});

verifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.validateFields(["otp"])) return;
  auth.hideStatus();
  const submit = submitButton(verifyForm, event);
  auth.setBusy(submit, true);
  try {
    const { response, data } = await auth.postJson("/api/auth/phone-number/verify", {
      phoneNumber: inputValue("phone").trim(),
      code: inputValue("otp").trim(),
    });
    if (!response.ok) {
      auth.showError(auth.GENERIC_OTP_VERIFY);
      return;
    }
    auth.continueAfterAuth(data);
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});
