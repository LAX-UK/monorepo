"use client";

import { ReauthDialog, useReauthGate } from "@/components/auth/reauth-gate";
import type { UserSessionRow } from "@/lib/data/user-session-row";
import {
  deleteSession as apiDeleteSession,
  revokeAllSessions,
} from "@/lib/services/client/sessions.api";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function formatUA(ua: string | null | undefined): string {
  if (ua == null || typeof ua !== "string") return "Unknown device";
  const trimmed = ua.trim();
  if (!trimmed) return "Unknown device";
  if (trimmed.length > 80) return `${trimmed.slice(0, 80)}…`;
  return trimmed;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function SessionsClientPage({ sessions }: { sessions: UserSessionRow[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const reauth = useReauthGate();

  useEffect(() => {
    setMounted(true);
  }, []);

  async function deleteSession(id: string) {
    setRevoking(id);
    const result = await apiDeleteSession(id);
    setRevoking(null);
    if (!result.ok) {
      if (result.error === "forbidden") {
        await reauth.prompt();
        return deleteSession(id);
      }
      notify.error("Could not revoke session. Please try again.");
      return;
    }
    notify.success("Session revoked.");
    router.refresh();
  }

  async function revokeAll() {
    setRevokingAll(true);
    const result = await revokeAllSessions();
    setRevokingAll(false);
    if (!result.ok) {
      if (result.error === "forbidden") {
        await reauth.prompt();
        return revokeAll();
      }
      notify.error("Could not revoke sessions. Please try again.");
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
              <p className="font-body text-xs text-on-surface-variant" suppressHydrationWarning>
                Signed in {mounted ? formatDate(s.createdAt) : "…"} · Expires{" "}
                {mounted ? formatDate(s.expiresAt) : "…"}
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
