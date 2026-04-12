"use client";

import { useCallback, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function HomeNewsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = useCallback(() => {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    window.setTimeout(() => {
      setStatus("success");
      setEmail("");
    }, 800);
  }, [email]);

  return (
    <section className="mx-auto max-w-5xl px-6 py-32 text-center md:px-20">
      <h2 className="mb-10 font-headline text-4xl font-light italic md:text-5xl">
        The Curator&apos;s Letter
      </h2>
      <p className="mx-auto mb-16 max-w-3xl text-lg font-light leading-relaxed text-on-surface-variant md:text-xl">
        Join our private circle for exclusive access to viewing rooms, early lot registration, and
        distinguished market analysis delivered with care.
      </p>
      {status === "success" ? (
        <p
          className="mx-auto max-w-xl font-body text-sm text-primary"
          role="status"
        >
          Thank you — you&apos;re on the list. We&apos;ll be in touch shortly.
        </p>
      ) : (
        <div className="relative mx-auto max-w-xl">
          <input
            type="email"
            placeholder="EMAIL FOR INVITATION"
            disabled={status === "loading"}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
            }}
            className="w-full border-0 border-b border-outline-variant/50 bg-transparent px-0 py-6 font-label text-xs font-bold uppercase tracking-[0.4em] text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-0 disabled:opacity-50"
            aria-label="Email for invitation"
            aria-invalid={status === "error"}
          />
          <button
            type="button"
            disabled={status === "loading"}
            onClick={onSubmit}
            className="absolute right-0 top-1/2 -translate-y-1/2 font-label text-xs font-bold uppercase tracking-[0.3em] text-primary transition-all duration-500 hover:tracking-[0.5em] disabled:opacity-50"
          >
            {status === "loading" ? "…" : "Subscribe"}
          </button>
          {status === "error" ? (
            <p className="mt-4 text-left text-sm text-error" role="alert">
              Enter a valid email address.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
