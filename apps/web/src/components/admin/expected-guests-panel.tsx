"use client";

import {
  adminAssignPaddleResultAction,
  adminClearPaddleResultAction,
  adminSaleroomCheckInResultAction,
} from "@/lib/actions/admin";
import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import { formatDateTime } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import type { OnsiteEventSegmentOption, SaleDeliveryMode } from "@auction/types";
import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const CHECK_IN_ERROR_MESSAGES: Record<string, string> = {
  sale_not_saleroom: "Check-in is only available for onsite or hybrid sales.",
  sale_not_registerable: "This sale is not open for check-in.",
  user_suspended: "This client account is suspended.",
  kyc_required: "Client must complete identity verification before check-in.",
  email_not_verified: "Client must verify their email address.",
  membership_required: "Client is not a member of the selected entity.",
  entity_not_authorised: "The selected entity is not authorised to bid.",
  not_eligible_for_check_in: "This membership type cannot be checked in for in-room bidding.",
  paddle_taken: "That paddle number is already in use.",
  invalid_paddle: "Paddle number must be at least 100.",
  rate_limited: "Too many attempts. Wait a moment and try again.",
};

type Props = {
  saleId: string;
  deliveryMode: SaleDeliveryMode;
  eventSlug: string;
  eventTitle: string;
  segmentOptions: OnsiteEventSegmentOption[];
  items: AdminExpectedGuestRow[];
};

function guestDisplayName(guest: AdminExpectedGuestRow): string {
  return guest.name ?? guest.email;
}

function segmentLabel(options: OnsiteEventSegmentOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value.replace(/_/g, " ");
}

function accountBlockers(guest: AdminExpectedGuestRow): string[] {
  const blockers: string[] = [];
  if (guest.suspended) blockers.push("Suspended");
  if (!guest.kycApproved) blockers.push("KYC");
  if (!guest.emailVerified) blockers.push("Email");
  return blockers;
}

function GuestGuidance({ guest }: { guest: AdminExpectedGuestRow }) {
  const blockers = accountBlockers(guest);
  const noEntity = guest.eligibleEntities.length === 0;

  if (blockers.length === 0 && !noEntity) return null;

  return (
    <div className="space-y-1 font-body text-xs text-on-surface-variant">
      {noEntity ? (
        <p>
          Set up at desk — no eligible buyer entity.{" "}
          <Link href="#check-in" className="text-link underline">
            Open desk check-in
          </Link>
        </p>
      ) : null}
      {blockers.length > 0 ? (
        <p>
          Resolve blockers before express check-in.{" "}
          <Link
            href={`/admin/clients/${encodeURIComponent(guest.userId)}`}
            className="text-link underline"
          >
            Open client profile
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function PaddleControls({
  saleId,
  guest,
  registrationId,
  onDone,
}: {
  saleId: string;
  guest: AdminExpectedGuestRow;
  registrationId: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);
  const [paddleInput, setPaddleInput] = useState("");

  const runReassign = () => {
    setError(null);
    const trimmed = paddleInput.trim();
    if (trimmed !== "") {
      const paddleN = Number.parseInt(trimmed, 10);
      if (!Number.isInteger(paddleN) || paddleN < 100) {
        setError(CHECK_IN_ERROR_MESSAGES.invalid_paddle ?? "Invalid paddle number");
        return;
      }
    }
    startTransition(async () => {
      const result = await adminAssignPaddleResultAction({
        saleId,
        registrationId,
        ...(trimmed !== "" ? { paddleNumber: Number.parseInt(trimmed, 10) } : {}),
      });
      if (!result.ok || !result.data) {
        setError(
          CHECK_IN_ERROR_MESSAGES[result.ok === false ? (result.errorCode ?? "") : ""] ??
            (result.ok === false ? result.error : "Reassign failed"),
        );
        return;
      }
      notify.success(`Paddle ${result.data.paddleNumber} assigned`, {
        description: guestDisplayName(guest),
      });
      setShowReassign(false);
      setPaddleInput("");
      onDone();
    });
  };

  const runClear = () => {
    setError(null);
    startTransition(async () => {
      const result = await adminClearPaddleResultAction({ saleId, registrationId });
      if (!result.ok) {
        setError(result.error ?? "Clear paddle failed");
        return;
      }
      notify.success("Paddle cleared", { description: guestDisplayName(guest) });
      onDone();
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setShowReassign((open) => !open)}
        >
          Reassign
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={runClear}>
          Clear
        </Button>
      </div>
      {showReassign ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={paddleInput}
            onChange={(e) => setPaddleInput(e.target.value)}
            placeholder="Auto-assign or enter #"
            className="h-8 w-36 font-body text-xs tabular-nums"
            aria-label="Paddle number for reassignment"
          />
          <Button type="button" size="sm" disabled={pending} onClick={runReassign}>
            Confirm
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="font-body text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ExpectedGuestRowActions({
  saleId,
  deliveryMode,
  guest,
  onPendingChange,
}: {
  saleId: string;
  deliveryMode: SaleDeliveryMode;
  guest: AdminExpectedGuestRow;
  onPendingChange: (pending: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entityId, setEntityId] = useState(() => {
    const personal = guest.eligibleEntities.find((e) => e.kind === "individual");
    return personal?.id ?? guest.eligibleEntities[0]?.id ?? "";
  });
  const [error, setError] = useState<string | null>(null);
  const isHybrid = deliveryMode === "hybrid";
  const blockers = accountBlockers(guest);
  const noEntity = guest.eligibleEntities.length === 0;
  const canAct = blockers.length === 0 && !noEntity && entityId.length > 0;
  const alreadyCheckedIn = guest.saleRegistration?.checkedInAt != null;
  const hasPaddle = guest.saleRegistration?.paddleNumber != null;
  const registrationId = guest.saleRegistration?.registrationId;

  const runCheckIn = (assignPaddle: boolean) => {
    if (!canAct) return;
    setError(null);
    onPendingChange(true);
    startTransition(async () => {
      try {
        const result = await adminSaleroomCheckInResultAction({
          saleId,
          userId: guest.userId,
          buyerLegalEntityId: entityId,
          assignPaddle,
        });
        if (!result.ok || !result.data) {
          setError(
            CHECK_IN_ERROR_MESSAGES[result.ok === false ? (result.errorCode ?? "") : ""] ??
              (result.ok === false ? result.error : "Check-in failed"),
          );
          return;
        }
        if (assignPaddle && result.data.paddleNumber != null) {
          notify.success(`Paddle ${result.data.paddleNumber} assigned`, {
            description: guestDisplayName(guest),
          });
        } else {
          notify.success("Marked present", { description: guestDisplayName(guest) });
        }
        router.refresh();
      } finally {
        onPendingChange(false);
      }
    });
  };

  if (alreadyCheckedIn) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Present</Badge>
          {hasPaddle && guest.saleRegistration?.paddleNumber != null ? (
            <Badge variant="outline">Paddle {guest.saleRegistration.paddleNumber}</Badge>
          ) : null}
          {!hasPaddle ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canAct || pending}
              onClick={() => runCheckIn(true)}
            >
              {isHybrid ? "Give paddle" : "Assign paddle"}
            </Button>
          ) : null}
        </div>
        {hasPaddle && registrationId ? (
          <PaddleControls
            saleId={saleId}
            guest={guest}
            registrationId={registrationId}
            onDone={() => router.refresh()}
          />
        ) : null}
      </div>
    );
  }

  if (noEntity || blockers.length > 0) {
    return <GuestGuidance guest={guest} />;
  }

  if (guest.eligibleEntities.length > 1) {
    return (
      <div className="flex flex-col items-end gap-2">
        <Select value={entityId} onValueChange={setEntityId}>
          <SelectTrigger className="h-8 w-44 font-body text-xs">
            <SelectValue placeholder="Entity…" />
          </SelectTrigger>
          <SelectContent>
            {guest.eligibleEntities.map((entity) => (
              <SelectItem key={entity.id} value={entity.id}>
                {entity.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          {isHybrid ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={!canAct || pending}
                onClick={() => runCheckIn(false)}
              >
                Mark present
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canAct || pending}
                onClick={() => runCheckIn(true)}
              >
                Give paddle
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={!canAct || pending}
              onClick={() => runCheckIn(true)}
            >
              Assign paddle
            </Button>
          )}
        </div>
        {error ? (
          <p className="font-body text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        {isHybrid ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={!canAct || pending}
              onClick={() => runCheckIn(false)}
            >
              Mark present
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canAct || pending}
              onClick={() => runCheckIn(true)}
            >
              Give paddle
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={!canAct || pending}
            onClick={() => runCheckIn(true)}
          >
            Assign paddle
          </Button>
        )}
      </div>
      {error ? (
        <p className="font-body text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ExpectedGuestRow({
  saleId,
  deliveryMode,
  guest,
  segmentOptions,
}: {
  saleId: string;
  deliveryMode: SaleDeliveryMode;
  guest: AdminExpectedGuestRow;
  segmentOptions: OnsiteEventSegmentOption[];
}) {
  const [rowPending, setRowPending] = useState(false);
  const blockers = accountBlockers(guest);
  const noEntity = guest.eligibleEntities.length === 0;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-opacity",
        rowPending && "opacity-60",
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{guestDisplayName(guest)}</p>
        <p className="font-body text-xs text-on-surface-variant">{guest.email}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{segmentLabel(segmentOptions, guest.attendanceSegment)}</Badge>
          {guest.galaCheckedInAt ? (
            <Badge variant="secondary">Gala {formatDateTime(guest.galaCheckedInAt)}</Badge>
          ) : null}
          {blockers.map((blocker) => (
            <Badge key={blocker} variant="destructive">
              {blocker}
            </Badge>
          ))}
          {noEntity ? <Badge variant="destructive">No entity</Badge> : null}
          {blockers.length === 0 && !noEntity ? <Badge variant="secondary">Ready</Badge> : null}
        </div>
      </div>
      <ExpectedGuestRowActions
        saleId={saleId}
        deliveryMode={deliveryMode}
        guest={guest}
        onPendingChange={setRowPending}
      />
    </li>
  );
}

export function ExpectedGuestsPanel({
  saleId,
  deliveryMode,
  eventSlug,
  eventTitle,
  segmentOptions,
  items,
}: Props) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((guest) => {
      const fields = [
        guest.name,
        guest.email,
        guest.attendanceSegment,
        segmentLabel(segmentOptions, guest.attendanceSegment),
      ];
      return fields.some((f) => f?.toLowerCase().includes(needle));
    });
  }, [items, search, segmentOptions]);

  const galaCheckedIn = items.filter((g) => g.galaCheckedInAt != null).length;
  const salePresent = items.filter((g) => g.saleRegistration?.checkedInAt != null).length;
  const paddled = items.filter((g) => g.saleRegistration?.paddleNumber != null).length;

  return (
    <div className="rounded-lg border border-border-hairline bg-surface-container-low/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-headline text-base font-semibold text-on-surface">Expected guests</h3>
          <p className="font-body text-sm text-on-surface-variant">
            RSVP guests from{" "}
            <Link
              href={`/admin/event-rsvps/${encodeURIComponent(eventSlug)}`}
              className="text-link underline"
            >
              {eventTitle}
            </Link>
            .{" "}
            {deliveryMode === "hybrid"
              ? "Hybrid sales default to marking present; assign a paddle only when the guest wants to bid in the room."
              : "Assign paddles for in-room bidding."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 font-body text-xs text-on-surface-variant">
          <span>
            RSVP&apos;d <strong className="tabular-nums text-on-surface">{items.length}</strong>
          </span>
          <span>
            Gala in <strong className="tabular-nums text-on-surface">{galaCheckedIn}</strong>
          </span>
          <span>
            Present <strong className="tabular-nums text-on-surface">{salePresent}</strong>
          </span>
          <span>
            Paddled <strong className="tabular-nums text-on-surface">{paddled}</strong>
          </span>
        </div>
      </div>

      <div className="mt-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expected guests…"
          className="max-w-sm font-body text-sm"
          aria-label="Search expected guests"
        />
      </div>

      <ul className="mt-4 divide-y divide-border-hairline rounded-md border border-border-hairline">
        {filtered.map((guest) => (
          <ExpectedGuestRow
            key={guest.rsvpId}
            saleId={saleId}
            deliveryMode={deliveryMode}
            guest={guest}
            segmentOptions={segmentOptions}
          />
        ))}
        {filtered.length === 0 ? (
          <li className="px-4 py-6 font-body text-sm text-on-surface-variant">
            No matching expected guests.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
