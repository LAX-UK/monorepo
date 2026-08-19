import { z } from "zod";

/**
 * High-signal blocklist of commonly used passwords.
 * Sourced from HaveIBeenPwned top-10k / curated corpus;
 * kept as a small bundler-friendly Set so it works in both Node and browser.
 */
const WEAK_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "password12345",
  "password123456",
  "123456789012",
  "qwertyuiop12",
  "welcome12345",
  "letmein123456",
  "sunshine1234",
  "iloveyou1234",
  "iloveyou123",
  "admin123456",
  "administrator",
  "changeme123",
  "welcome1234",
  "abc123456789",
  "monkey123456",
  "dragon123456",
  "master123456",
  "superman1234",
  "batman123456",
  "pokemon12345",
  "football1234",
  "baseball1234",
  "basketball12",
  "liverpool123",
  "chelsea12345",
  "trustno11234",
  "mustang12345",
  "shadow123456",
  "michael12345",
  "jessica12345",
  "thomas123456",
  "robert123456",
  "andrew123456",
  "daniel123456",
  "george123456",
  "jordan123456",
  "harley123456",
  "ranger123456",
  "hockey123456", // gitleaks:allow
  "hunter123456",
  "morgan123456",
  "joseph123456",
  "charlie12345",
  "andrea123456",
  "nicole123456",
  "joshua123456",
  "william12345",
  "taylor123456",
  "matthew12345",
  "amanda123456",
  "access123456", // gitleaks:allow
  "qwerty123456",
  "asdfgh123456",
  "zxcvbn123456",
]);

export function meetsComplexityRequirement(password: string): boolean {
  let score = 0;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score >= 3;
}

export function newPasswordWeakListCheck(
  password: string,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  const lower = password.toLowerCase();
  if (WEAK_PASSWORDS.has(lower)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "This password is too common",
      path,
    });
    return;
  }
  if (!meetsComplexityRequirement(password)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Password must contain characters from at least 3 of: uppercase, lowercase, numbers, symbols",
      path,
    });
  }
}
