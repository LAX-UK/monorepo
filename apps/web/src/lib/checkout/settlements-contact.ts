/** Buyer-facing settlements contact from public env (set at build/deploy time). */
export function settlementsEmail(): string | null {
  const value = process.env.NEXT_PUBLIC_SETTLEMENTS_EMAIL?.trim();
  return value && value.length > 0 ? value : null;
}

export function settlementsPhone(): string | null {
  const value = process.env.NEXT_PUBLIC_SETTLEMENTS_PHONE?.trim();
  return value && value.length > 0 ? value : null;
}

/** Display copy when email env is unset — avoids fake placeholder addresses in production. */
export function settlementsEmailDisplay(): string {
  return settlementsEmail() ?? "Contact support through your account dashboard";
}

export function formatSettlementsContactLine(): string {
  const email = settlementsEmail();
  const phone = settlementsPhone();
  if (email && phone) return `${email} · ${phone}`;
  if (email) return email;
  if (phone) return phone;
  return settlementsEmailDisplay();
}
