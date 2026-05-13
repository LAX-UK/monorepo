import { authSubmitFailure } from "@/lib/auth/auth-error-code";
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
      return authSubmitFailure("newsletter_submit_failed");
    }
    const body = (await res.json()) as { ok?: boolean; status?: string };
    if (body.ok !== true) {
      return authSubmitFailure("newsletter_submit_failed");
    }
    const disposition =
      body.status === "already_subscribed"
        ? ("already_subscribed" as const)
        : ("subscribed" as const);
    return { ok: true, newsletterDisposition: disposition };
  }
}

export const defaultNewsletterSubmitter = new StubNewsletterSubmitter();
