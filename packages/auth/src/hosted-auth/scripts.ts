import { readHostedAsset } from "./assets.js";

export { readHostedAsset } from "./assets.js";

export const HOSTED_AUTH_RUNTIME_SCRIPT = readHostedAsset("hosted-auth-runtime.js");
export const HOSTED_LOGIN_SCRIPT = readHostedAsset("hosted-login.js");
export const HOSTED_SIGN_UP_SCRIPT = readHostedAsset("hosted-sign-up.js");
export const HOSTED_FORGOT_PASSWORD_SCRIPT = readHostedAsset("hosted-forgot-password.js");
export const HOSTED_RESET_PASSWORD_SCRIPT = readHostedAsset("hosted-reset-password.js");
export const HOSTED_TWO_FACTOR_SCRIPT = readHostedAsset("hosted-two-factor.js");
export const HOSTED_VERIFY_EMAIL_SCRIPT = readHostedAsset("hosted-verify-email.js");
export const HOSTED_RESEND_VERIFICATION_SCRIPT = readHostedAsset("hosted-resend-verification.js");
export const HOSTED_MAGIC_LINK_SCRIPT = readHostedAsset("hosted-magic-link.js");
export const HOSTED_PHONE_SCRIPT = readHostedAsset("hosted-phone.js");
export const OIDC_CONSENT_SCRIPT = readHostedAsset("oidc-consent.js");
