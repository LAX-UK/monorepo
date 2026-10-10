import { safeRelativeReturnPath } from "@auction/identity-rp";

export function safeReturnTo(raw: string | null | undefined, fallback = "/account"): string {
  return safeRelativeReturnPath(raw?.trim()) ?? fallback;
}
