"use client";

import { adminAtgSaleSettingsAction } from "@/lib/actions/admin-atg";
import { formatDateTime } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import {
  type AtgAuctionType,
  type AtgDistribution,
  type AtgSaleSyncView,
  canChangeAtgAuctionType,
  canChangeAtgDistribution,
} from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Option<V extends string> = { value: V; label: string; description?: string };

const AUCTION_TYPE_OPTIONS: Option<AtgAuctionType>[] = [
  { value: "Timed", label: "Timed" },
  { value: "Live", label: "Live" },
];

const DISTRIBUTION_OPTIONS: Option<AtgDistribution>[] = [
  { value: "private_test", label: "Private test", description: "Hidden from public listings" },
  { value: "public_marketplace", label: "Public", description: "White Label and The Saleroom" },
];

const TYPE_HINT = "Live for saleroom sales with online bidding, Timed for online-only sales.";
const TYPE_FIXED = "Fixed: ATG already has this auction.";
const DISTRIBUTION_HINT = "Public auctions appear on both the White Label and The Saleroom.";
const DISTRIBUTION_FIXED = "Fixed: the auction is already published on ATG.";

type Props = {
  saleId: string;
  view: AtgSaleSyncView;
  canManage: boolean;
  /** Another ATG action is running: the choices wait for it. */
  busy: boolean;
  /** Why the sale's state keeps these settings as they are (cancelled, on lax.bid, closed). */
  lockedReason?: string | undefined;
  /** Called with the queued push job when a linked sale was re-pushed. */
  onSaved: (pushJobId: string | null) => void;
};

function optionLabel<V extends string>(options: Option<V>[], value: V): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function fixedBecause(reason: string): string {
  return `Fixed: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`;
}

/** A value that can't change, at full contrast, with the reason under it. */
function ReadOnlyValue({
  label,
  value,
  hint,
}: { label: string; value: string; hint: string | null }) {
  return (
    <div className="space-y-1">
      <dt className="font-label text-xs uppercase tracking-wide text-on-surface-variant">
        {label}
      </dt>
      <dd className="text-sm text-on-surface">{value}</dd>
      {hint ? <dd className="text-xs text-on-surface-variant">{hint}</dd> : null}
    </div>
  );
}

/** A locked choice: the value in a read-only field, so it reads at full contrast. */
function FixedChoice({ label, value, hint }: { label: string; value: string; hint: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} readOnly value={value} />
      <p className="text-xs text-on-surface-variant">{hint}</p>
    </div>
  );
}

function RadioChoices<V extends string>({
  label,
  hint,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: V;
  options: Option<V>[];
  disabled: boolean;
  onChange: (next: V) => void;
}) {
  const id = useId();
  // The label stays at full contrast while the choices wait; each choice shows the disabled state.
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p id={`${id}-label`} className="font-medium text-sm text-on-surface">
          {label}
        </p>
        <p className="text-xs text-on-surface-variant">{hint}</p>
      </div>
      <RadioGroup
        value={value}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        onValueChange={(next) => onChange(next as V)}
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-start gap-2.5">
            <RadioGroupItem
              id={`${id}-${option.value}`}
              value={option.value}
              className="mt-0.5"
              {...(option.description ? { "aria-describedby": `${id}-${option.value}-hint` } : {})}
            />
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-${option.value}`} className="text-sm">
                {option.label}
              </Label>
              {option.description ? (
                <p id={`${id}-${option.value}-hint`} className="text-xs text-on-surface-variant">
                  {option.description}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

/** The auction type and distribution ATG gets for this sale, locked once ATG has the auction. */
export function AtgSettingsSection({
  saleId,
  view,
  canManage,
  busy,
  lockedReason,
  onSaved,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [auctionType, setAuctionType] = useState(view.settings.auctionType);
  const [distribution, setDistribution] = useState(view.settings.distribution);
  const [confirmingPublic, setConfirmingPublic] = useState(false);

  const typeLocked = !canChangeAtgAuctionType(view);
  const distributionLocked = !canChangeAtgDistribution(view);
  const readOnly = !canManage || Boolean(lockedReason) || (typeLocked && distributionLocked);
  const dirty =
    auctionType !== view.settings.auctionType || distribution !== view.settings.distribution;
  const goingPublic =
    distribution === "public_marketplace" && view.settings.distribution !== "public_marketplace";
  const choicesDisabled = busy || pending;

  function save(confirmPublic: boolean) {
    startTransition(async () => {
      const result = await adminAtgSaleSettingsAction(
        saleId,
        { auctionType, distribution },
        confirmPublic,
      );
      setConfirmingPublic(false);
      if (!result.ok) {
        notify.error(result.error);
        router.refresh();
        return;
      }
      notify.success("ATG settings saved", {
        description: result.data?.pushJobId
          ? "Sending the change to ATG now."
          : view.linked
            ? "Push to ATG to send the change."
            : "They apply when you push this sale to ATG.",
      });
      onSaved(result.data?.pushJobId ?? null);
      router.refresh();
    });
  }

  const header = (
    <div className="space-y-1">
      <h3 id="atg-settings-heading" className="font-medium text-on-surface">
        ATG settings
      </h3>
      <p className="text-sm text-on-surface-variant">
        The auction type and distribution ATG gets for this sale. Platform, default category and bid
        increments come from LAX&apos;s ATG account setup.
        {view.settingsUpdatedAt ? ` Last changed ${formatDateTime(view.settingsUpdatedAt)}.` : ""}
      </p>
    </div>
  );

  if (readOnly) {
    const stateHint = lockedReason ? fixedBecause(lockedReason) : null;
    return (
      <section aria-labelledby="atg-settings-heading" className="space-y-4">
        {header}
        <dl className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyValue
            label="Auction type"
            value={optionLabel(AUCTION_TYPE_OPTIONS, view.settings.auctionType)}
            hint={typeLocked ? TYPE_FIXED : stateHint}
          />
          <ReadOnlyValue
            label="Distribution"
            value={optionLabel(DISTRIBUTION_OPTIONS, view.settings.distribution)}
            hint={distributionLocked ? DISTRIBUTION_FIXED : stateHint}
          />
        </dl>
      </section>
    );
  }

  return (
    <section aria-labelledby="atg-settings-heading" className="space-y-4">
      {header}

      <div className="grid gap-6 sm:grid-cols-2">
        {typeLocked ? (
          <FixedChoice
            label="Auction type"
            value={optionLabel(AUCTION_TYPE_OPTIONS, auctionType)}
            hint={TYPE_FIXED}
          />
        ) : (
          <RadioChoices
            label="Auction type"
            hint={TYPE_HINT}
            value={auctionType}
            options={AUCTION_TYPE_OPTIONS}
            disabled={choicesDisabled}
            onChange={setAuctionType}
          />
        )}

        {distributionLocked ? (
          <FixedChoice
            label="Distribution"
            value={optionLabel(DISTRIBUTION_OPTIONS, distribution)}
            hint={DISTRIBUTION_FIXED}
          />
        ) : (
          <RadioChoices
            label="Distribution"
            hint={DISTRIBUTION_HINT}
            value={distribution}
            options={DISTRIBUTION_OPTIONS}
            disabled={choicesDisabled}
            onChange={setDistribution}
          />
        )}
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={!dirty || choicesDisabled}
        onClick={() => (goingPublic ? setConfirmingPublic(true) : save(false))}
      >
        {view.linked ? "Save and send to ATG" : "Save changes"}
      </Button>

      {confirmingPublic ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmingPublic(false);
          }}
          title="List this sale publicly?"
          body="When it is published, the auction appears on the LAX White Label and on The Saleroom marketplace, where anyone can find and bid. Only switch once the private test has passed. You can switch back until it is published."
          confirmLabel="List publicly"
          tone="warning"
          loading={pending}
          onConfirm={() => save(true)}
        />
      ) : null}
    </section>
  );
}
