export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your email address";
  const first = local.slice(0, 1);
  const last = local.length > 1 ? local.slice(-1) : "";
  return `${first}${"*".repeat(Math.max(2, local.length - 2))}${last}@${domain}`;
}
