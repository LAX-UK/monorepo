"use client";

import {
  adminSaleroomCheckInCandidatesResultAction,
  adminSaleroomCheckInResultAction,
} from "@/lib/actions/admin";
import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import {
  BID_LIMIT_FIELD_LABEL,
  bidLimitFieldHelp,
  bidLimitFieldPlaceholder,
} from "@/lib/saleroom/bid-limit-field-copy";
import { formatMoney } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

const CHECK_IN_ERROR_MESSAGES: Record<string, string> = {
  sale_not_saleroom: "Check-in is only available for onsite or hybrid sales.",
  sale_not_registerable: "This sale is not open for check-in.",
  user_suspended: "This client account is suspended.",
  kyc_required: "Client must complete identity verification before check-in.",
  email_not_verified: "Client must verify their email address.",
  membership_required: "Client is not a member of the selected entity.",
  entity_not_authorised: "The selected entity is not authorised to bid.",
  not_eligible_for_check_in: "This membership type cannot be checked in for in-room bidding.",
  paddle_taken: "That paddle number is already in use. Try another or leave blank to auto-assign.",
  invalid_paddle: "Paddle number must be at least 100.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
};

type Props = {
  saleId: string;
  saleCurrency?: string;
};

function displayName(candidate: AdminCheckInCandidate): string {
  return candidate.name ?? candidate.email;
}

export function SaleroomCheckInPanel({ saleId, saleCurrency = "GBP" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<AdminCheckInCandidate[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState("");
  const [bidLimit, setBidLimit] = useState("");
  const [paddleNumber, setPaddleNumber] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ name: string; paddleNumber: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const searchGenerationRef = useRef(0);

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.userId === selectedUserId) ?? null,
    [candidates, selectedUserId],
  );

  const eligibleEntities = selectedCandidate?.eligibleEntities ?? [];

  useEffect(() => {
    if (!selectedCandidate) {
      setEntityId("");
      setBidLimit("");
      return;
    }
    const personal = eligibleEntities.find((e) => e.kind === "individual");
    const nextEntityId = personal?.id ?? eligibleEntities[0]?.id ?? "";
    setEntityId(nextEntityId);
    const ent = eligibleEntities.find((e) => e.id === nextEntityId);
    const existingLimit = ent?.existingRegistration?.bidLimit;
    setBidLimit(existingLimit?.replace(/\.00$/, "") ?? "");
  }, [selectedCandidate, eligibleEntities]);

  const runSearch = useCallback(
    async (q: string, generation: number) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        if (generation === searchGenerationRef.current) {
          setCandidates([]);
          setSearchError(null);
          setSearching(false);
        }
        return;
      }
      setSearching(true);
      setSearchError(null);
      const result = await adminSaleroomCheckInCandidatesResultAction({ saleId, q: trimmed });
      if (generation !== searchGenerationRef.current) return;
      setSearching(false);
      if (!result.ok) {
        setSearchError(result.error);
        setCandidates([]);
        return;
      }
      setCandidates(result.data?.items ?? []);
      setSelectedUserId(null);
    },
    [saleId],
  );

  useEffect(() => {
    const generation = ++searchGenerationRef.current;
    const handle = window.setTimeout(() => {
      void runSearch(query, generation);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, runSearch]);

  const prerequisitesOk =
    selectedCandidate != null &&
    !selectedCandidate.suspended &&
    selectedCandidate.kycStatus === "approved" &&
    selectedCandidate.emailVerified &&
    entityId.length > 0;

  const blockerMessages = useMemo(() => {
    if (!selectedCandidate) return [];
    const items: string[] = [];
    if (selectedCandidate.suspended) items.push("Account is suspended.");
    if (selectedCandidate.kycStatus !== "approved") {
      items.push("Identity verification is not complete.");
    }
    if (!selectedCandidate.emailVerified) items.push("Email address is not verified.");
    return items;
  }, [selectedCandidate]);

  const onCheckIn = () => {
    if (!selectedCandidate || !entityId) return;
    setSubmitError(null);
    const paddleTrimmed = paddleNumber.trim();
    if (paddleTrimmed !== "") {
      const paddleN = Number.parseInt(paddleTrimmed, 10);
      if (!Number.isInteger(paddleN) || paddleN < 100) {
        setSubmitError(
          CHECK_IN_ERROR_MESSAGES.invalid_paddle ?? "Paddle number must be at least 100.",
        );
        return;
      }
    }
    startTransition(async () => {
      const body: {
        saleId: string;
        userId: string;
        buyerLegalEntityId: string;
        bidLimit?: number;
        paddleNumber?: number;
      } = {
        saleId,
        userId: selectedCandidate.userId,
        buyerLegalEntityId: entityId,
      };
      const limitN = Number.parseFloat(bidLimit);
      if (bidLimit.trim() !== "" && Number.isFinite(limitN) && limitN > 0) {
        body.bidLimit = limitN;
      }
      if (paddleTrimmed !== "") {
        body.paddleNumber = Number.parseInt(paddleTrimmed, 10);
      }

      const result = await adminSaleroomCheckInResultAction(body);
      if (!result.ok || !result.data) {
        if (result.ok === false) {
          setSubmitError(CHECK_IN_ERROR_MESSAGES[result.errorCode ?? ""] ?? result.error);
        } else {
          setSubmitError("Check-in failed");
        }
        return;
      }
      setSuccess({
        name: displayName(selectedCandidate),
        paddleNumber: result.data.paddleNumber,
      });
      notify.success(`Paddle ${result.data.paddleNumber} assigned`, {
        description: "Return to the clerk console to place in-room bids.",
      });
      router.refresh();
    });
  };

  const resetForAnother = () => {
    setSuccess(null);
    setQuery("");
    setCandidates([]);
    setSelectedUserId(null);
    setBidLimit("");
    setPaddleNumber("");
    setSubmitError(null);
  };

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      setSuccess(null);
      setQuery("");
      setCandidates([]);
      setSelectedUserId(null);
      setBidLimit("");
      setPaddleNumber("");
      setSubmitError(null);
    }, 3_000);
    return () => window.clearTimeout(timer);
  }, [success]);

  if (success) {
    return (
      <div
        id="check-in"
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5"
        aria-live="polite"
      >
        <p className="font-body text-sm text-on-surface">
          Paddle <strong className="tabular-nums">{success.paddleNumber}</strong> assigned to{" "}
          <strong>{success.name}</strong>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="default">
            <Link href={`/admin/saleroom/${saleId}?checkedIn=1`}>Open clerk console</Link>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={resetForAnother}>
            Check in another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="check-in"
      className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-5"
    >
      <div className="space-y-1">
        <h3 className="font-headline text-base font-semibold text-on-surface">In-room check-in</h3>
        <p className="font-body text-sm text-on-surface-variant">
          For bidders attending in person. The client must already have an account and completed
          KYC.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="check-in-search">Search client</Label>
          <Input
            id="check-in-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type email or name (min 2 characters)"
            className="font-body text-sm"
            autoComplete="off"
          />
          {query.trim().length < 2 ? (
            <p className="font-body text-xs text-on-surface-variant">
              Type email or name (min 2 characters)
            </p>
          ) : null}
          {searching ? (
            <p className="font-body text-xs text-on-surface-variant">Searching…</p>
          ) : null}
          {searchError ? (
            <p className="font-body text-xs text-destructive" role="alert">
              {searchError}
            </p>
          ) : null}
        </div>

        {candidates.length > 0 ? (
          <ul className="space-y-2" aria-label="Search results">
            {candidates.map((c) => {
              const selected = c.userId === selectedUserId;
              const existingPaddle = c.eligibleEntities.find(
                (e) => e.existingRegistration?.paddleNumber != null,
              )?.existingRegistration?.paddleNumber;
              return (
                <li key={c.userId}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border-hairline hover:bg-surface-container-low/60"
                    }`}
                    onClick={() => setSelectedUserId(c.userId)}
                  >
                    <p className="font-medium">{displayName(c)}</p>
                    <p className="font-body text-xs text-on-surface-variant">{c.email}</p>
                    <p className="mt-1 font-body text-xs text-on-surface-variant">
                      KYC: {c.kycStatus}
                      {existingPaddle != null ? <> · Already paddle #{existingPaddle}</> : null}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {selectedCandidate ? (
          <div className="space-y-3 rounded-md border border-border-hairline p-4">
            {blockerMessages.length > 0 ? (
              <ul className="space-y-1" role="alert">
                {blockerMessages.map((msg) => (
                  <li key={msg} className="font-body text-xs text-destructive">
                    {msg}
                  </li>
                ))}
                <li>
                  <Link
                    href={`/admin/clients/${selectedCandidate.userId}`}
                    className="font-body text-xs text-link underline"
                  >
                    Open client profile
                  </Link>
                </li>
              </ul>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="check-in-entity">Buying as</Label>
              <Select
                value={entityId}
                onValueChange={(id) => {
                  setEntityId(id);
                  const ent = eligibleEntities.find((e) => e.id === id);
                  const existingLimit = ent?.existingRegistration?.bidLimit;
                  setBidLimit(existingLimit?.replace(/\.00$/, "") ?? "");
                }}
              >
                <SelectTrigger id="check-in-entity" className="font-body text-sm">
                  <SelectValue placeholder="Select entity…" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleEntities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.displayName} ({e.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="check-in-bid-limit">{BID_LIMIT_FIELD_LABEL}</Label>
                <Input
                  id="check-in-bid-limit"
                  type="number"
                  min={0}
                  step="0.01"
                  value={bidLimit}
                  onChange={(e) => setBidLimit(e.target.value)}
                  placeholder={bidLimitFieldPlaceholder(saleCurrency)}
                  className="font-body text-sm"
                />
                <p className="font-body text-xs text-on-surface-variant">
                  {bidLimitFieldHelp(saleCurrency)}
                </p>
                {(() => {
                  const selectedEntity = eligibleEntities.find((e) => e.id === entityId);
                  const existingLimit = selectedEntity?.existingRegistration?.bidLimit;
                  return existingLimit && bidLimit.trim() === "" ? (
                    <p className="font-body text-xs text-secondary">
                      Current limit: {formatMoney(existingLimit, saleCurrency)}
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="space-y-1">
                <Label htmlFor="check-in-paddle">Paddle number</Label>
                <Input
                  id="check-in-paddle"
                  value={paddleNumber}
                  onChange={(e) => setPaddleNumber(e.target.value)}
                  placeholder="Leave blank to auto-assign"
                  className="font-body text-sm tabular-nums"
                />
              </div>
            </div>

            {submitError ? (
              <p className="font-body text-xs text-destructive" role="alert" aria-live="polite">
                {submitError}
              </p>
            ) : null}

            <Button
              type="button"
              disabled={!prerequisitesOk || pending}
              onClick={onCheckIn}
              className="min-h-10"
            >
              {pending ? "Checking in…" : "Check in and assign paddle"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
