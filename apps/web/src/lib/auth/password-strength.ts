export type PasswordStrengthResult = { label: string; width: number };

export function passwordStrength(p: string): PasswordStrengthResult {
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  const capped = Math.min(score, 4);
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  return {
    label: labels[capped] ?? "Too short",
    width: capped === 0 && p.length > 0 ? 12 : capped * 25,
  };
}
