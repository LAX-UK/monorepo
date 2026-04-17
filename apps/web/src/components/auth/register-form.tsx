"use client";

import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      const res = await fetch(`${apiBase()}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setLoading(false);
      if (!res.ok) {
        setError(body.error ?? "Could not register");
        return;
      }
      router.push("/login?next=/dashboard");
      router.refresh();
    },
    [email, name, password, router],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div>
        <label
          htmlFor="register-name"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-on-surface-variant"
        >
          Name
        </label>
        <UnderlineInput
          id="register-name"
          autoComplete="name"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
          required
          className="w-full border-b-2 border-outline-variant/40 py-3"
        />
      </div>
      <div>
        <label
          htmlFor="register-email"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-on-surface-variant"
        >
          Email
        </label>
        <UnderlineInput
          id="register-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          required
          className="w-full border-b-2 border-outline-variant/40 py-3"
        />
      </div>
      <div>
        <label
          htmlFor="register-password"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-on-surface-variant"
        >
          Password
        </label>
        <UnderlineInput
          id="register-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          required
          minLength={8}
          className="w-full border-b-2 border-outline-variant/40 py-3"
        />
        <p id="register-password-hint" className="mt-2 font-body text-xs text-on-surface-variant">
          At least 8 characters.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-error" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="w-full py-5" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center font-body text-xs text-on-surface-variant">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
