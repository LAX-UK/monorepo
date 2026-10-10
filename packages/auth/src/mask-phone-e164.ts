export function maskPhoneE164(e164: string): string {
  const trimmed = e164.trim();
  if (trimmed.length <= 4) return "****";
  const prefix = trimmed.startsWith("+") ? trimmed.slice(0, 3) : trimmed.slice(0, 2);
  const suffix = trimmed.slice(-2);
  return `${prefix}******${suffix}`;
}
