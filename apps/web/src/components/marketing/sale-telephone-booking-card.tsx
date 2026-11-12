"use client";

import type { TelephoneBookingPanelEntity } from "@/components/marketing/sale-telephone-booking-panel";
import { LazySaleTelephoneBookingPanelForm } from "@/components/marketing/sale-telephone-booking-panel.lazy";
import type { TelephoneBookingSnapshot } from "@/lib/telephone/telephone-booking-types";
import { TelephoneParticipationGate } from "@/lib/telephone/telephone-participation-gate";
import { Button } from "@auction/ui/lax/button";
import Link from "next/link";
import { useState } from "react";

type Props = {
  saleId: string;
  saleTitle: string;
  loginNextPath: string;
  isAuthenticated: boolean;
  kycApproved: boolean;
  mobile: string | null;
  phoneNumberVerified?: boolean;
  mobileDisplay?: string | null;
  buyerEntities: TelephoneBookingPanelEntity[];
  existingBooking?: TelephoneBookingSnapshot | null;
  orgModuleEnabled?: boolean;
};

export type SaleTelephoneBookingCardProps = Props;

export function SaleTelephoneBookingCard({
  saleId,
  saleTitle,
  loginNextPath,
  isAuthenticated,
  kycApproved,
  mobile,
  phoneNumberVerified = false,
  mobileDisplay,
  buyerEntities,
  existingBooking = null,
  orgModuleEnabled = true,
}: Props) {
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onBooked = (booking: TelephoneBookingSnapshot) => {
    setCreatedBookingId(booking.id);
    setDone(true);
  };

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-6 dark:bg-surface-container-low/40">
        <p className="font-body text-sm text-on-surface">
          Telephone line requested for {saleTitle}. Our team will confirm before your lots open.
        </p>
        {createdBookingId ? (
          <Button variant="secondary" asChild>
            <Link href={`/bids/telephone/${createdBookingId}`}>View booking</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      id="bid-onsite-hub"
      className="scroll-mt-[calc(var(--header-height)+3.5rem)] space-y-4 rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-6 dark:bg-surface-container-low/40"
    >
      <div className="space-y-1">
        <h4 className="font-headline text-base font-semibold text-on-surface">Telephone bidding</h4>
        <p className="font-body text-xs text-on-surface-variant leading-relaxed">
          Request a live telephone line for this sale. Staff will call the mobile number on your
          profile when your lot is approaching the block.
        </p>
      </div>
      <TelephoneParticipationGate
        isAuthenticated={isAuthenticated}
        kycApproved={kycApproved}
        mobile={mobile}
        phoneNumberVerified={phoneNumberVerified}
        {...(mobileDisplay ? { mobileDisplay } : {})}
        buyerEntities={buyerEntities}
        loginNextPath={loginNextPath}
        orgModuleEnabled={orgModuleEnabled}
        existingBooking={existingBooking}
      >
        <LazySaleTelephoneBookingPanelForm
          saleId={saleId}
          buyerEntities={buyerEntities}
          contactNumber={mobileDisplay ?? mobile}
          onBooked={onBooked}
        />
      </TelephoneParticipationGate>
    </div>
  );
}
