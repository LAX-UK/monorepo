"use client";

import {
  adminSaleroomCheckInCandidatesResultAction,
  adminSaleroomCheckInResultAction,
} from "@/lib/actions/admin";
import type { AdminCheckInCandidate } from "@/lib/data/http/admin.server";
import { saleroomCheckInErrorMessage } from "@/lib/saleroom/check-in-error-messages";
import { notify } from "@/lib/ui/notify";
import { Notice, Section, StaffButton, staffButtonVariants } from "@auction/staff-ui";
import type { SaleDeliveryMode } from "@auction/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { SaleroomCheckInForm } from "./saleroom-check-in-form";
import { SaleroomCheckInSearch } from "./saleroom-check-in-search";

type Props = {
  saleId: string;
  saleCurrency?: string;
  deliveryMode?: SaleDeliveryMode;
};

function displayName(candidate: AdminCheckInCandidate): string {
  return candidate.name ?? candidate.email;
}

export function SaleroomCheckInPanel({
  saleId,
  saleCurrency = "GBP",
  deliveryMode = "onsite",
}: Props) {
  const isHybrid = deliveryMode === "hybrid";
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
  const [success, setSuccess] = useState<{
    name: string;
    paddleNumber: number | null;
    markedPresentOnly: boolean;
  } | null>(null);
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

  const onCheckIn = (assignPaddle: boolean) => {
    if (!selectedCandidate || !entityId) return;
    setSubmitError(null);
    const paddleTrimmed = paddleNumber.trim();
    if (assignPaddle && paddleTrimmed !== "") {
      const paddleN = Number.parseInt(paddleTrimmed, 10);
      if (!Number.isInteger(paddleN) || paddleN < 100) {
        setSubmitError(
          saleroomCheckInErrorMessage("invalid_paddle", "Paddle number must be at least 100."),
        );
        return;
      }
    }
    startTransition(async () => {
      const body: {
        saleId: string;
        userId: string;
        buyerLegalEntityId: string;
        assignPaddle: boolean;
        bidLimit?: number;
        paddleNumber?: number;
      } = {
        saleId,
        userId: selectedCandidate.userId,
        buyerLegalEntityId: entityId,
        assignPaddle,
      };
      const limitN = Number.parseFloat(bidLimit);
      if (bidLimit.trim() !== "" && Number.isFinite(limitN) && limitN > 0) {
        body.bidLimit = limitN;
      }
      if (assignPaddle && paddleTrimmed !== "") {
        body.paddleNumber = Number.parseInt(paddleTrimmed, 10);
      }

      const result = await adminSaleroomCheckInResultAction(body);
      if (!result.ok || !result.data) {
        if (result.ok === false) {
          setSubmitError(saleroomCheckInErrorMessage(result.errorCode, result.error));
        } else {
          setSubmitError("Check-in failed");
        }
        return;
      }
      setSuccess({
        name: displayName(selectedCandidate),
        paddleNumber: result.data.paddleNumber,
        markedPresentOnly: !assignPaddle,
      });
      if (assignPaddle && result.data.paddleNumber != null) {
        notify.success(`Paddle ${result.data.paddleNumber} assigned`, {
          description: "Return to the clerk console to place in-room bids.",
        });
      } else {
        notify.success("Marked present", {
          description: "Guest can bid online; assign a paddle later if needed.",
        });
      }
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
      <Section id="check-in" title="In-room check-in" className="scroll-mt-20">
        <Notice
          tone="success"
          title={
            success.markedPresentOnly
              ? `${success.name} is marked present`
              : `Paddle ${success.paddleNumber} assigned to ${success.name}`
          }
          actions={
            <>
              <Link
                href={`/admin/saleroom/${encodeURIComponent(saleId)}?checkedIn=1`}
                className={staffButtonVariants({ variant: "primary", size: "sm" })}
              >
                Open clerk console
              </Link>
              <StaffButton size="sm" variant="secondary" onClick={resetForAnother}>
                Check in another
              </StaffButton>
            </>
          }
        />
      </Section>
    );
  }

  return (
    <Section
      id="check-in"
      title="In-room check-in"
      description="For bidders attending in person. The client needs an account and a completed identity check."
      className="scroll-mt-20"
    >
      <div className="flex flex-col gap-4">
        <SaleroomCheckInSearch
          query={query}
          onQueryChange={setQuery}
          searching={searching}
          searchError={searchError}
          candidates={candidates}
          selectedUserId={selectedUserId}
          onSelectCandidate={setSelectedUserId}
        />

        {selectedCandidate ? (
          <SaleroomCheckInForm
            candidate={selectedCandidate}
            saleCurrency={saleCurrency}
            isHybrid={isHybrid}
            entityId={entityId}
            onEntityIdChange={setEntityId}
            bidLimit={bidLimit}
            onBidLimitChange={setBidLimit}
            paddleNumber={paddleNumber}
            onPaddleNumberChange={setPaddleNumber}
            submitError={submitError}
            pending={pending}
            onCheckIn={onCheckIn}
          />
        ) : null}
      </div>
    </Section>
  );
}
