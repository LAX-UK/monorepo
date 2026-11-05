import { legalAcceptanceFields } from "./legal-acceptance.js";

/** The product on the sign-up page, for the email form and the Google/Apple buttons alike. */
export function signUpLegalAcceptanceFields(): Record<string, { product: string }> {
  return legalAcceptanceFields(document.getElementById("signup-root")?.dataset.legalProduct);
}
