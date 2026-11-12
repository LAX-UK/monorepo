"use client";

import { DEFAULT_OFFER_DAYS, MAX_OFFER_DAYS, MIN_OFFER_DAYS, offerEndsAt } from "@auction/domain";
import {
  EnumSelect,
  Field,
  Notice,
  StaffButton,
  StaffDialog,
  formatStaffDateTime,
  formatStaffMoney,
} from "@auction/staff-ui";
import type { StaffReoffer } from "@auction/validators";
import { Check } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const BLOCKED_HINT = "Fix the check above, or choose the next bidder";

type Props = {
  open: boolean;
  offer: StaffReoffer;
  busy: boolean;
  /** The API's refusal, kept in the dialog. */
  failure: { message: string; code: string | null } | null;
  onSend: (offerDays: number) => void;
  /** Withdraws this offer so the next bidder can be chosen. */
  onChooseNext: () => void;
  onOpenChange: (open: boolean) => void;
};

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-medium text-staff-fg" : "text-staff-muted"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold text-staff-fg" : "text-staff-fg"}`}>
        {value}
      </dd>
    </div>
  );
}

/** The last look before the bidder is told: the price they would pay, the checks, and how long. */
export function SendOfferDialog({
  open,
  offer,
  busy,
  failure,
  onSend,
  onChooseNext,
  onOpenChange,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [days, setDays] = useState(DEFAULT_OFFER_DAYS);
  const name = offer.bidder.accountName ?? "the next bidder";
  const { price } = offer;
  // The end date is worked out in London time, as the API will, so staff see the real deadline.
  const options = useMemo(() => {
    const now = new Date();
    return Array.from({ length: MAX_OFFER_DAYS - MIN_OFFER_DAYS + 1 }, (_, index) => {
      const value = MIN_OFFER_DAYS + index;
      return {
        value: String(value),
        label: `In ${value} ${value === 1 ? "day" : "days"} · ${formatStaffDateTime(offerEndsAt(now, value))}`,
      };
    });
  }, []);
  const blocked = failure?.code === "bidder_unavailable";

  const agreed =
    offer.consentStatus === "not_needed"
      ? "LAX-owned, no consent needed"
      : `Seller agreed${offer.consent.answeredAt ? ` · ${formatStaffDateTime(offer.consent.answeredAt)}` : ""}`;

  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Send the offer to ${name}?`}
      description="They'll get an email and see the offer in their workspace. They're not told who the first buyer was."
      size="md"
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton
            variant="primary"
            loading={busy}
            {...(blocked ? { disabledReason: BLOCKED_HINT } : {})}
            onClick={() => onSend(days)}
          >
            Send offer
          </StaffButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {failure ? (
          <Notice tone="danger" alert title={blocked ? failure.message : "That did not go through"}>
            {blocked ? (
              <StaffButton size="sm" variant="secondary" onClick={onChooseNext}>
                Choose the next bidder
              </StaffButton>
            ) : (
              failure.message
            )}
          </Notice>
        ) : null}
        <dl className="flex flex-col gap-1.5 text-staff-sm">
          <Line label="Hammer (their bid)" value={formatStaffMoney(price.hammerMinor)} />
          <Line label="Buyer's premium" value={formatStaffMoney(price.buyersPremiumMinor)} />
          <Line label="VAT on the premium" value={formatStaffMoney(price.vatOnPremiumMinor)} />
          <div className="my-1 border-t border-staff-line" />
          <Line label="Total they'll pay" value={formatStaffMoney(price.totalMinor)} strong />
        </dl>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-staff-sm font-medium text-staff-fg">Checks</h3>
          <ul className="flex flex-col gap-1 text-staff-sm text-staff-fg">
            <li className="flex items-center gap-2">
              <Check aria-hidden className="size-4 shrink-0 text-staff-success" />
              {agreed}
            </li>
          </ul>
          <p className="text-staff-xs text-staff-muted">
            Their account and bidding limit are checked again when you send.
          </p>
        </div>
        <Field label="Offer ends">
          <EnumSelect
            value={String(days)}
            onValueChange={(value) => setDays(Number(value))}
            options={options}
            disabled={busy}
          />
        </Field>
      </div>
    </StaffDialog>
  );
}
