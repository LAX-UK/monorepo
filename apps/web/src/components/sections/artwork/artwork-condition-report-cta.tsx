"use client";

import { kycLinkActionLabel } from "@/components/kyc/kyc-copy";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { Button } from "@auction/ui/components/button";
import { Textarea } from "@auction/ui/components/textarea";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  lotId: string;
  loginNextPath: string;
  isAuthenticated: boolean;
  show: boolean;
  kycApproved: boolean;
  kycFeedback?: KycUserFeedbackDto | null;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function ArtworkConditionReportCta({
  lotId,
  loginNextPath,
  isAuthenticated,
  show,
  kycApproved,
  kycFeedback = null,
}: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  if (!isAuthenticated) {
    return (
      <div className="rounded-md border border-outline-variant/30 bg-surface-container-low/50 p-3">
        <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Condition report
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2 min-h-9 w-full">
          <Link href={`/login?next=${encodeURIComponent(loginNextPath)}`}>Sign in to request</Link>
        </Button>
      </div>
    );
  }

  if (!kycApproved) {
    return (
      <div className="rounded-md border border-outline-variant/30 bg-surface-container-low/50 p-3">
        <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Condition report
        </p>
        <p className="mt-1 font-body text-xs text-secondary">
          {kycFeedback?.detail ??
            kycFeedback?.headline ??
            "Verify your identity to request a condition report."}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-2 min-h-9 w-full">
          <Link href={`/dashboard/verify-identity?next=${encodeURIComponent(loginNextPath)}`}>
            {kycLinkActionLabel(kycFeedback, "long")}
          </Link>
        </Button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch(
        `${apiBase()}/lots/${encodeURIComponent(lotId)}/condition-report-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(note.trim() ? { requestNote: note.trim() } : {}),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        setErr(payload.error ?? "Request failed");
        return;
      }
      setMsg("Request received. Our specialists will prepare a report.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-outline-variant/30 bg-surface-container-low/50 p-3">
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Condition report
      </p>
      <p className="mt-1 font-body text-xs text-secondary">
        Request a formal condition report for this lot.
      </p>
      <form onSubmit={(e) => void submit(e)} className="mt-2 space-y-2">
        <Textarea
          value={note}
          onChange={(ev) => setNote(ev.target.value)}
          placeholder="Optional note for the specialist…"
          className="min-h-16 font-body text-xs"
        />
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
        {msg ? <p className="text-xs text-primary">{msg}</p> : null}
        <Button type="submit" size="sm" disabled={loading} className="min-h-9 w-full">
          {loading ? "Sending…" : "Request condition report"}
        </Button>
      </form>
    </div>
  );
}
