"use server";

import { consoleContactDispatcher } from "@/lib/contact/contact-dispatcher";
import { isContactHoneypotFilled, parseContactFormData } from "@/lib/contact/contact-input";
import { createInMemorySlidingWindowRateLimiter } from "@/lib/rate-limit/in-memory-rate-limiter";
import { headers } from "next/headers";

const rateLimiter = createInMemorySlidingWindowRateLimiter({
  windowMs: 60_000,
  maxPerWindow: 4,
});

async function rateLimitKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  return ip;
}

export type ContactActionState = { ok: boolean; error?: string };

export async function submitContactForm(
  _prev: ContactActionState | undefined,
  formData: FormData,
): Promise<ContactActionState> {
  if (isContactHoneypotFilled(formData)) {
    return { ok: true };
  }

  const parsed = parseContactFormData(formData);
  if (!parsed.ok) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const key = await rateLimitKey();
  if (!rateLimiter.consume(key)) {
    return { ok: false, error: "Too many submissions. Please wait a minute and try again." };
  }

  await consoleContactDispatcher.dispatch(parsed.data);

  return { ok: true };
}
