import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

/** DIP: swap for Mailchimp / CRM later without changing the form. */
export interface INewsletterSubmitter {
  submit(email: string): Promise<AuthSubmitResult>;
}

export class StubNewsletterSubmitter implements INewsletterSubmitter {
  constructor(private readonly subscribePath = "/api/newsletter/subscribe") {}

  async submit(email: string): Promise<AuthSubmitResult> {
    const res = await fetch(this.subscribePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    const body = (await res.json()) as { ok?: boolean; status?: string };
    if (body.ok !== true) {
      return { ok: false, message: "Something went wrong. Please try again." };
    }
    return body.status ? { ok: true, code: body.status } : { ok: true };
  }
}

export const defaultNewsletterSubmitter = new StubNewsletterSubmitter();
