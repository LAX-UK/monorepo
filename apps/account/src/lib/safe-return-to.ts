import { safeRelativeReturnPath } from "@auction/identity-rp/safe-return-path";

export function safeReturnTo(raw: string | null | undefined, fallback = "/account"): string {
  return safeRelativeReturnPath(raw?.trim()) ?? fallback;
}
