"use client";

import { adminSaleroomCheckInResultAction } from "@/lib/actions/admin";
import type { AdminExpectedGuestRow } from "@/lib/data/http/admin-expected-guests.server";
import { saleroomCheckInErrorMessage } from "@/lib/saleroom/check-in-error-messages";
import { notify } from "@/lib/ui/notify";
import type { SaleDeliveryMode } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { Button } from "@auction/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GuestGuidance } from "./guest-guidance";
import { accountBlockers, guestDisplayName } from "./guest-helpers";
import { PaddleControls } from "./paddle-controls";
import { useGuestCheckInEntity } from "./use-expected-guests";

export function ExpectedGuestRowActions({
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
  const { entityId, setEntityId } = useGuestCheckInEntity(guest);
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
            saleroomCheckInErrorMessage(
              result.ok === false ? result.errorCode : undefined,
              result.ok === false ? result.error : "Check-in failed",
            ),
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
