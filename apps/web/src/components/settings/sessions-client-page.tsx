"use client";

import type { SessionRow } from "@/app/dashboard/settings/sessions/page";
import { ReauthDialog, useReauthGate } from "@/components/auth/reauth-gate";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

function formatUA(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (ua.length > 80) return `${ua.slice(0, 80)}…`;
  return ua;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function SessionsClientPage({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const reauth = useReauthGate();

  async function deleteSession(id: string) {
    setRevoking(id);
    const res = await fetch(`${apiBase}/users/me/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    setRevoking(null);
    if (res.status === 403) {
      await reauth.prompt();
      return deleteSession(id);
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      notify.error(typeof body.message === "string" ? body.message : "Could not revoke session.");
      return;
    }
    notify.success("Session revoked.");
    router.refresh();
  }

  async function revokeAll() {
    setRevokingAll(true);
    const res = await fetch(`${apiBase}/users/me/sessions/revoke-all`, {
      method: "POST",
      credentials: "include",
    });
    setRevokingAll(false);
    if (res.status === 403) {
      await reauth.prompt();
      return revokeAll();
    }
    if (!res.ok) {
      notify.error("Could not revoke sessions.");
      return;
    }
    notify.success("All other sessions revoked. You may need to sign in on those devices.");
    router.refresh();
  }

  const others = sessions.filter((s) => !s.isCurrent);

  return (
    <>
      <ReauthDialog
        open={reauth.open}
        onClose={() => reauth.setOpen(false)}
        onSubmit={(pw) => void reauth.submit(pw)}
        busy={reauth.busy}
        error={reauth.error}
      />

      <div className="space-y-3">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-start justify-between gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate font-body text-sm font-medium text-on-surface">
                {formatUA(s.userAgent)}
                {s.isCurrent ? (
                  <span className="ml-2 rounded-full bg-primary-container/50 px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-primary">
                    Current
                  </span>
                ) : null}
              </p>
              {s.ipAddress ? (
                <p className="font-body text-xs text-on-surface-variant">{s.ipAddress}</p>
              ) : null}
              <p className="font-body text-xs text-on-surface-variant">
                Signed in {formatDate(s.createdAt)} · Expires {formatDate(s.expiresAt)}
              </p>
            </div>
            {!s.isCurrent ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={revoking === s.id}
                onClick={() => void deleteSession(s.id)}
              >
                {revoking === s.id ? "Revoking…" : "Revoke"}
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {others.length > 1 ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={revokingAll}
          onClick={() => void revokeAll()}
        >
          {revokingAll ? "Revoking…" : `Revoke all ${others.length} other sessions`}
        </Button>
      ) : null}
    </>
  );
}
