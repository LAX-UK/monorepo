"use client";

import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";

/** Newsletter hook: same loading/banner contract as auth forms (DIP). */
export function useNewsletterSubmit(onExecute: (email: string) => Promise<AuthSubmitResult>) {
  return useAuthSubmit(async (data: { email: string }) => onExecute(data.email));
}
