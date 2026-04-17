"use client";

import { parseNotificationPreference } from "@/lib/data/http/parse";
import { registerPushSubscription, urlBase64ToUint8Array } from "@/lib/push/subscribe";
import type { NotificationPreference } from "@auction/types";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-4 border-b border-outline-variant/10 py-3 font-body text-sm">
      <span id={labelId}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-outline-variant/40"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-surface-container-lowest shadow transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`${apiBase()}/users/me/preferences/notifications`, {
      credentials: "include",
    });
    if (!res.ok) {
      setPrefs(null);
      return;
    }
    const body = (await res.json()) as { data: unknown };
    setPrefs(parseNotificationPreference(body.data));
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const save = async (patch: Partial<NotificationPreference>) => {
    if (!prefs) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase()}/users/me/preferences/notifications`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error("Could not save preferences");
        return;
      }
      const body = (await res.json()) as { data: unknown };
      setPrefs(parseNotificationPreference(body.data));
      toast.success("Preferences saved");
    } finally {
      setSaving(false);
    }
  };

  const onEnablePush = async () => {
    setPushBusy(true);
    try {
      const res = await fetch(`${apiBase()}/users/me/push/vapid-key`, { credentials: "include" });
      const body = (await res.json()) as { data?: { publicKey?: string | null } };
      const key = body.data?.publicKey;
      if (!key) {
        toast.error("Push is not configured on the server (missing VAPID keys).");
        return;
      }
      await registerPushSubscription(key);
      toast.success("Browser notifications enabled");
      await save({ outbidPush: true, wonPush: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enable push");
    } finally {
      setPushBusy(false);
    }
  };

  if (loading || !prefs) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="font-body text-sm text-on-surface-variant">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link
        href="/dashboard/notifications"
        className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
      >
        Back to inbox
      </Link>
      <h1 className="mt-4 font-headline text-2xl text-on-surface">Alert settings</h1>
      <p className="mt-2 font-body text-sm text-on-surface-variant">
        Choose which alerts you want in-app and via browser push. Quiet hours apply to push only.
      </p>

      <section className="mt-8">
        <h2 className="font-label text-xs uppercase tracking-widest text-secondary">In-app</h2>
        <Toggle
          label="Outbid"
          checked={prefs.outbidInApp}
          onChange={(v) => void save({ outbidInApp: v })}
        />
        <Toggle
          label="Won auctions"
          checked={prefs.wonInApp}
          onChange={(v) => void save({ wonInApp: v })}
        />
        <Toggle
          label="Lost auctions"
          checked={prefs.lostInApp}
          onChange={(v) => void save({ lostInApp: v })}
        />
        <Toggle
          label="Ending soon"
          checked={prefs.endingSoonInApp}
          onChange={(v) => void save({ endingSoonInApp: v })}
        />
        <Toggle
          label="Watchlist"
          checked={prefs.watchlistInApp}
          onChange={(v) => void save({ watchlistInApp: v })}
        />
        <Toggle
          label="Payments"
          checked={prefs.paymentInApp}
          onChange={(v) => void save({ paymentInApp: v })}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-label text-xs uppercase tracking-widest text-secondary">Push</h2>
        <Toggle
          label="Outbid (push)"
          checked={prefs.outbidPush}
          onChange={(v) => void save({ outbidPush: v })}
        />
        <Toggle
          label="Won (push)"
          checked={prefs.wonPush}
          onChange={(v) => void save({ wonPush: v })}
        />
        <Toggle
          label="Ending soon (push)"
          checked={prefs.endingSoonPush}
          onChange={(v) => void save({ endingSoonPush: v })}
        />
        <div className="mt-4">
          <button
            type="button"
            disabled={pushBusy || saving}
            onClick={() => void onEnablePush()}
            className="rounded-md bg-primary px-4 py-3 font-label text-xs uppercase tracking-widest text-on-primary disabled:opacity-50"
          >
            {pushBusy ? "Working…" : "Enable browser push"}
          </button>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-label text-xs uppercase tracking-widest text-secondary">
          Quiet hours (UTC, push)
        </h2>
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="font-body text-sm">
            Start
            <input
              type="time"
              value={prefs.quietStart ?? ""}
              onChange={(e) => void save({ quietStart: e.target.value || null })}
              className="mt-1 block w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 py-2"
            />
          </label>
          <label className="font-body text-sm">
            End
            <input
              type="time"
              value={prefs.quietEnd ?? ""}
              onChange={(e) => void save({ quietEnd: e.target.value || null })}
              className="mt-1 block w-full rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 py-2"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
