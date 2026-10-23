/**
 * Brand Identity v1.0 literals for issuer-hosted credential chrome.
 *
 * Identity extractability forbids importing `@auction/branding` from this
 * package. Keep hex, type, and company name in lockstep with
 * `packages/branding` — `packages/branding/tests/tokens.test.ts` reads this
 * file and fails the branding suite on drift.
 */
export const HOSTED_AUTH_TOKENS = {
  obsidian: "#000000",
  /** LAX Account teal: the accent of every hosted page (PRODUCT_ACCENTS.account in @auction/branding). */
  accent: "#0f766e",
  accentOnDark: "#2dd4bf",
  white: "#ffffff",
  lightCream: "#f2f1df",
  ink: "#191919",
  textSecondary: "#474747",
  pageBg: "#ffffff",
  surface: "#ffffff",
  border: "#e6e8eb",
  red: "#e83030",
  /** Darker red and green for text on white: the brand values fall under 4.5:1 there. */
  errorOnLight: "#b3261e",
  successOnLight: "#1a7f37",
  /** Form-control boundaries need 3:1 against the surface (WCAG 1.4.11). */
  inputBorder: "#767676",
  darkInputBorder: "#8c8c88",
  darkPageBg: "#121414",
  darkSurface: "#1a1c1c",
  darkTextSecondary: "#c9c5bc",
  darkBorder: "#333534",
  companyName: "London Art Exchange",
  fontBody: '"Montserrat", "Outfit", Helvetica, Arial, "Helvetica Neue", sans-serif',
  fontSupporting: '"Outfit", "Montserrat", Helvetica, Arial, sans-serif',
} as const;
