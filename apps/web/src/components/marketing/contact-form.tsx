"use client";

import { type ContactActionState, submitContactForm } from "@/app/(marketing)/contact/actions";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { useFormState, useFormStatus } from "react-dom";

const initial: ContactActionState = { ok: false };

function SubmitRow() {
  const { pending } = useFormStatus();
  return (
    <AuthSubmitButton loading={pending} loadingLabel="Sending…" className="w-full sm:w-auto">
      Send message
    </AuthSubmitButton>
  );
}

export function ContactForm() {
  const [state, formAction] = useFormState(submitContactForm, initial);

  if (state.ok) {
    return (
      <output
        className="block rounded-lg border border-primary/30 bg-primary-container/10 px-6 py-8 font-body text-sm text-on-surface"
        aria-live="polite"
      >
        Thank you — we&apos;ve received your message and will respond within two business days
        (GMT).
      </output>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <p
          className="rounded-sm border border-error/40 bg-error-container/20 px-4 py-3 text-sm text-error"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden
      />
      <div>
        <label
          htmlFor="contact-name"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
        >
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          required
          maxLength={120}
          className="w-full rounded-md border border-outline-variant/40 bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      </div>
      <div>
        <label
          htmlFor="contact-email"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
        >
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          inputMode="email"
          required
          className="w-full rounded-md border border-outline-variant/40 bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      </div>
      <div>
        <label
          htmlFor="contact-topic"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
        >
          Topic
        </label>
        <select
          id="contact-topic"
          name="topic"
          required
          className="w-full rounded-md border border-outline-variant/40 bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <option value="buying">Buying</option>
          <option value="selling">Selling</option>
          <option value="shipping">Shipping</option>
          <option value="press">Press</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label
          htmlFor="contact-message"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-secondary"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          rows={6}
          className="w-full rounded-md border border-outline-variant/40 bg-surface px-4 py-3 font-body text-sm text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
      </div>
      <SubmitRow />
    </form>
  );
}
