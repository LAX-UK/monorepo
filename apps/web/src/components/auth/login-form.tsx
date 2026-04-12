"use client";

import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      const { error: signErr } = await authClient.signIn.email({
        email,
        password,
      });
      setLoading(false);
      if (signErr) {
        setError(signErr.message ?? "Could not sign in");
        return;
      }
      router.push(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    },
    [email, password, next, router],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {searchParams.get("auth") === "required" ? (
        <p className="rounded-md bg-primary-container/20 px-4 py-3 font-body text-sm text-on-primary-container">
          Please sign in to continue.
        </p>
      ) : null}
      <div>
        <label
          htmlFor="login-email"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-on-surface-variant"
        >
          Email
        </label>
        <UnderlineInput
          id="login-email"
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
          htmlFor="login-password"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-on-surface-variant"
        >
          Password
        </label>
        <UnderlineInput
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          required
          className="w-full border-b-2 border-outline-variant/40 py-3"
        />
      </div>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" className="w-full py-5" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center font-body text-xs text-on-surface-variant">
        <Link href="/" className="text-primary underline-offset-4 hover:underline">
          Back to gallery
        </Link>
      </p>
    </form>
  );
}
