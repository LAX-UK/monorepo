import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { PhoneInputValues } from "@auction/validators";

export async function submitAccountOnboarding(input: {
  firstName: string;
  lastName: string;
  persona: "individual" | "organisation";
  acceptTerms: boolean;
  inviteToken?: string;
  phone?: PhoneInputValues;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await browserFetch(`${browserApiBase()}/users/me/onboarding`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      message: payload.error ?? "Could not save your details. Please try again.",
    };
  }
  await fetch("/api/onboarding/invite", { method: "DELETE", credentials: "same-origin" }).catch(
    () => undefined,
  );
  return { ok: true };
}
