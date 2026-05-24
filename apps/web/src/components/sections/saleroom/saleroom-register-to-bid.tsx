"use client";

import { kycLinkActionLabel } from "@/components/kyc/kyc-copy";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import type { LegalEntityMemberRole } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Entity = { id: string; displayName: string; memberRole: LegalEntityMemberRole };

type Props = {
  saleId: string;
  loginNextPath: string;
  isAuthenticated: boolean;
  show: boolean;
  buyerEntities: Entity[];
  myRegistrations: { buyerLegalEntityId: string; status: string }[];
  kycApproved: boolean;
  kycFeedback?: KycUserFeedbackDto | null;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

export function SaleroomRegisterToBid({
  saleId,
  loginNextPath,
  isAuthenticated,
  show,
  buyerEntities,
  myRegistrations,
  kycApproved,
  kycFeedback = null,
}: Props) {
  const router = useRouter();
  const [entityId, setEntityId] = useState("");
  const [bidLimit, setBidLimit] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const statusByLe = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of myRegistrations) {
      m.set(r.buyerLegalEntityId, r.status);
    }
    return m;
  }, [myRegistrations]);

  const agentEntities = useMemo(
    () => buyerEntities.filter((e) => e.memberRole === "buyer_agent"),
    [buyerEntities],
  );

  if (!show) return null;

  if (!isAuthenticated) {
    return (
      <Button asChild variant="outline" size="lg" className="min-h-11 shrink-0">
        <Link href={`/login?next=${encodeURIComponent(loginNextPath)}`}>Register to bid</Link>
      </Button>
    );
  }

  if (!kycApproved) {
    return (
      <div className="flex min-w-0 max-w-md flex-col gap-2 sm:max-w-sm">
        {kycFeedback?.detail ? (
          <p className="font-body text-xs text-secondary">{kycFeedback.detail}</p>
        ) : null}
        <Button asChild variant="outline" size="lg" className="min-h-11 shrink-0">
          <Link href={`/dashboard/verify-identity?next=${encodeURIComponent(loginNextPath)}`}>
            {kycFeedback ? kycLinkActionLabel(kycFeedback, "long") : "Verify identity to bid"}
          </Link>
        </Button>
      </div>
    );
  }

  if (buyerEntities.length === 0) {
    return (
      <Button asChild variant="outline" size="lg" className="min-h-11 shrink-0">
        <Link href="/onboarding/organisation">Set up a buyer profile</Link>
      </Button>
    );
  }

  if (agentEntities.length === 0) {
    return null;
  }

  const selectedStatus = entityId ? statusByLe.get(entityId) : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!entityId) {
      setError("Choose the legal entity you are bidding as.");
      return;
    }
    setLoading(true);
    try {
      const body: { buyerLegalEntityId: string; bidLimit?: number } = {
        buyerLegalEntityId: entityId,
      };
      const n = Number.parseFloat(bidLimit);
      if (bidLimit.trim() !== "" && Number.isFinite(n) && n > 0) {
        body.bidLimit = n;
      }
      const res = await fetch(`${apiBase()}/sales/${encodeURIComponent(saleId)}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        setError(payload.error ?? "Could not submit registration");
        return;
      }
      setMessage(
        selectedStatus === "pending" || selectedStatus === "approved"
          ? "Registration updated."
          : "Registration submitted. Our team will review it shortly.",
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex w-full min-w-0 max-w-md flex-col gap-2 rounded-md border border-outline-variant/30 bg-surface-container-low/40 p-3 sm:max-w-sm"
    >
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Register to bid
      </p>
      <label className="font-body text-xs text-secondary">
        Buying as
        <select
          className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-sm"
          value={entityId}
          onChange={(ev) => setEntityId(ev.target.value)}
          required
        >
          <option value="">Select legal entity…</option>
          {agentEntities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.displayName}
            </option>
          ))}
        </select>
      </label>
      {entityId && selectedStatus ? (
        <p className="font-body text-xs text-secondary">
          Status for this sale:{" "}
          <span className="font-medium text-on-surface">{selectedStatus}</span>
        </p>
      ) : null}
      <label className="font-body text-xs text-secondary">
        Optional bid limit (same currency as the sale)
        <input
          type="number"
          min={0}
          step="0.01"
          className="mt-1 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-sm"
          value={bidLimit}
          onChange={(ev) => setBidLimit(ev.target.value)}
          placeholder="e.g. 50000"
        />
      </label>
      {error ? <p className="font-body text-xs text-destructive">{error}</p> : null}
      {message ? <p className="font-body text-xs text-primary">{message}</p> : null}
      <Button type="submit" disabled={loading} className="min-h-11 w-full sm:w-auto" size="sm">
        {loading ? "Submitting…" : "Submit registration"}
      </Button>
    </form>
  );
}
