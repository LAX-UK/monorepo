"use client";

import { useAppSession } from "@/lib/auth/use-app-session";
import { notify } from "@/lib/ui/notify";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useState } from "react";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

type Props = {
  label: string;
  query: Record<string, string>;
  /** Compact pill for the desktop toolbar (vs. full-width sheet button). */
  compact?: boolean;
  className?: string;
};

/** Persists current search filters for signed-in users. */
export function SaveSearchButton({ label, query, compact = false, className }: Props) {
  const { user } = useAppSession();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) return null;

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
      setSaved(true);
      notify.success("Search saved");
    } catch {
      notify.error("Could not save search");
    } finally {
      setSaving(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className={cn(
          "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-outline-variant/40 px-4 font-label text-xs font-semibold uppercase tracking-wider text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50",
          className,
        )}
      >
        {saved ? (
          <BookmarkCheck className="size-4" aria-hidden />
        ) : (
          <Bookmark className="size-4" aria-hidden />
        )}
        {saving ? "Saving…" : saved ? "Saved" : "Save search"}
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("min-h-10 w-full", className)}
      disabled={saving}
      onClick={() => void save()}
    >
      {saving ? "Saving…" : saved ? "Search saved" : "Save this search"}
    </Button>
  );
}
