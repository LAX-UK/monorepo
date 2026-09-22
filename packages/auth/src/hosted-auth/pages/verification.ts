import {
  buildHostedAuthHtml,
  continuationAnchor,
  floatingInput,
  hostedButton,
  statusRegions,
} from "../html.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export {
  HOSTED_VERIFY_EMAIL_SCRIPT,
  HOSTED_RESEND_VERIFICATION_SCRIPT,
} from "../scripts.js";

export function buildHostedVerifyEmailHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: "Verify your email",
    description: "Open the verification link from your inbox or request a new one below.",
    brand: view.brand,
    config: view.config,
    body: `<div class="auth-stack">
      <div id="pending" hidden>
        <p class="lead">Verifying your email…</p>
      </div>
      ${statusRegions()}
      <div class="links">
        ${continuationAnchor("Resend verification email", "/resend-verification", view.flow)}
        ${continuationAnchor("Return to sign in", "/login", view.flow)}
      </div>
    </div>`,
    scriptSrc: "/hosted-verify-email.js",
  });
}

export function buildHostedResendVerificationHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: "Resend verification",
    description: "Enter your email address and we will send a fresh verification link.",
    brand: view.brand,
    config: view.config,
    body: `<form id="resend-form" class="auth-form" novalidate>
      ${floatingInput({ id: "email", label: "Email Address", type: "email", autocomplete: "username" })}
      ${hostedButton({ label: "Send verification email", loadingLabel: "Sending…" })}
      ${statusRegions()}
      <div class="links">${continuationAnchor("Back to sign in", "/login", view.flow)}</div>
    </form>`,
    scriptSrc: "/hosted-resend-verification.js",
  });
}
