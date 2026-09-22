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
  midnight: "#091f5b",
  lightCream: "#f2f1df",
  ink: "#191919",
  textSecondary: "#474747",
  pageBg: "#ffffff",
  surface: "#ffffff",
  border: "#e6e8eb",
  red: "#e83030",
  darkPageBg: "#121414",
  darkSurface: "#1a1c1c",
  darkTextSecondary: "#c9c5bc",
  darkBorder: "#333534",
  companyName: "London Art Exchange",
  fontBody: '"Montserrat", "Outfit", Helvetica, Arial, "Helvetica Neue", sans-serif',
  fontSupporting: '"Outfit", "Montserrat", Helvetica, Arial, sans-serif',
} as const;
