import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import { newsletterSubmitFailure } from "@/lib/newsletter/newsletter-failure";

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
      return newsletterSubmitFailure();
    }
    const body = (await res.json()) as { ok?: boolean; status?: string };
    if (body.ok !== true) {
      return newsletterSubmitFailure();
    }
    const disposition =
      body.status === "already_subscribed"
        ? ("already_subscribed" as const)
        : ("subscribed" as const);
    return { ok: true, newsletterDisposition: disposition };
  }
}

export const defaultNewsletterSubmitter = new StubNewsletterSubmitter();
