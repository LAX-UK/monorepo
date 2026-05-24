"use client";

import { authClient } from "@/lib/auth-client";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

type Props = {
  label: string;
  query: Record<string, string>;
};

/** Persists current search filters for signed-in users. */
export function SaveSearchButton({ label, query }: Props) {
  const session = authClient.useSession();
  const [saving, setSaving] = useState(false);

  if (!session.data?.user) return null;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase()}/users/me/saved-searches`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, query, notifyEmail: true }),
      });
      if (!res.ok) {
        notify.error("Could not save search");
        return;
      }
      notify.success("Search saved");
    } catch {
      notify.error("Could not save search");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-10 w-full"
      disabled={saving}
      onClick={() => void save()}
    >
      {saving ? "Saving…" : "Save this search"}
    </Button>
  );
}
