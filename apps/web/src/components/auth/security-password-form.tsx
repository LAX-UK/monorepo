"use client";

import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
import { useCallback, useState } from "react";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function SecurityPasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setOk(null);
      setLoading(true);
      const res = await fetch(`${apiBase()}/api/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: false }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setLoading(false);
      if (!res.ok) {
        setError(typeof body.message === "string" ? body.message : "Could not change password");
        return;
      }
      setOk("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    },
    [currentPassword, newPassword],
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="current-password"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-on-surface-variant"
        >
          Current password
        </label>
        <UnderlineInput
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(ev) => setCurrentPassword(ev.target.value)}
          required
          className="w-full border-b-2 border-outline-variant/40 py-3"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "pwd-error" : undefined}
        />
      </div>
      <div>
        <label
          htmlFor="new-password"
          className="mb-2 block font-label text-xs uppercase tracking-widest text-on-surface-variant"
        >
          New password
        </label>
        <UnderlineInput
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(ev) => setNewPassword(ev.target.value)}
          required
          minLength={8}
          className="w-full border-b-2 border-outline-variant/40 py-3"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "pwd-error" : undefined}
        />
      </div>
      {error ? (
        <p id="pwd-error" className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? <output className="block text-sm text-primary">{ok}</output> : null}
      <Button type="submit" variant="primary" className="w-full" disabled={loading}>
        {loading ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
