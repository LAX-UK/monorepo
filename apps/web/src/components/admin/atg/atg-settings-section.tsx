"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminAtgSaleSettingsAction } from "@/lib/actions/admin-atg";
import { notify } from "@/lib/ui/notify";
import {
  ChoiceRow,
  Field,
  FieldRow,
  FormActions,
  type KeyValueItem,
  KeyValueList,
  Notice,
  Section,
  StaffButton,
  StaffDate,
  StaffRadio,
  StaffRadioGroup,
  TextInput,
  UnsavedChangesGuard,
} from "@auction/staff-ui";
import {
  type AtgAuctionType,
  type AtgDistribution,
  type AtgSaleSyncView,
  canChangeAtgAuctionType,
  canChangeAtgDistribution,
} from "@auction/types";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useRef, useState, useTransition } from "react";

type Option<V extends string> = { value: V; label: string; description?: string };

const AUCTION_TYPE_OPTIONS: Option<AtgAuctionType>[] = [
  { value: "Timed", label: "Timed" },
  { value: "Live", label: "Live" },
];

const DISTRIBUTION_OPTIONS: Option<AtgDistribution>[] = [
  {
    value: "private_test",
    label: "Private test",
    description: "Hidden from public listings",
  },
  {
    value: "public_marketplace",
    label: "Public",
    description: "White Label and The Saleroom",
  },
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

/** A value shown read-only, with why it can't change under it. */
function ReadOnlyValue({ value, hint }: { value: string; hint: string | null }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>{value}</span>
      {hint ? <span className="text-staff-xs text-staff-muted">{hint}</span> : null}
    </span>
  );
}

function RadioChoices<V extends string>({
  label,
  description,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: V;
  options: Option<V>[];
  disabled: boolean;
  onChange: (next: V) => void;
}) {
  const id = useId();
  // The label stays at full contrast while the choices wait; each choice shows the disabled state.
  return (
    <Field id={id} label={label} description={description}>
      <StaffRadioGroup
        id={id}
        value={value}
        disabled={disabled}
        aria-label={label}
        onValueChange={(next) => onChange(next as V)}
      >
        {options.map((option) => (
          <ChoiceRow
            key={option.value}
            htmlFor={`${id}-${option.value}`}
            label={option.label}
            {...(option.description ? { description: option.description } : {})}
            disabled={disabled}
            control={
              <StaffRadio id={`${id}-${option.value}`} value={option.value} disabled={disabled} />
            }
          />
        ))}
      </StaffRadioGroup>
    </Field>
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
  const confirm = useStaffConfirm();
  const [pending, startTransition] = useTransition();
  const [auctionType, setAuctionType] = useState(view.settings.auctionType);
  const [distribution, setDistribution] = useState(view.settings.distribution);
  const [failure, setFailure] = useState<string | null>(null);
  const queuedJob = useRef<string | null>(null);

  const typeLocked = !canChangeAtgAuctionType(view);
  const distributionLocked = !canChangeAtgDistribution(view);
  const readOnly = !canManage || Boolean(lockedReason) || (typeLocked && distributionLocked);
  const dirty =
    auctionType !== view.settings.auctionType || distribution !== view.settings.distribution;
  const goingPublic =
    distribution === "public_marketplace" && view.settings.distribution !== "public_marketplace";
  const choicesDisabled = busy || pending;

  const toastSaved = (pushJobId: string | null) =>
    pushJobId
      ? "Sending the change to ATG now."
      : view.linked
        ? "Push to ATG to send the change."
        : "They apply when you push this sale to ATG.";

  function save() {
    setFailure(null);
    startTransition(async () => {
      const result = await adminAtgSaleSettingsAction(saleId, { auctionType, distribution }, false);
      if (!result.ok) {
        setFailure(result.error);
        router.refresh();
        return;
      }
      const pushJobId = result.data?.pushJobId ?? null;
      notify.success("ATG settings saved", { description: toastSaved(pushJobId) });
      onSaved(pushJobId);
      router.refresh();
    });
  }

  function askPublic() {
    setFailure(null);
    queuedJob.current = null;
    confirm.ask({
      title: "List this sale publicly?",
      description:
        "When it is published, the auction appears on the LAX White Label and on The Saleroom marketplace, where anyone can find and bid. Only switch once the private test has passed. You can switch back until it is published.",
      confirmLabel: "List publicly",
      tone: "default",
      run: async () => {
        const result = await adminAtgSaleSettingsAction(
          saleId,
          { auctionType, distribution },
          true,
        );
        if (!result.ok) return { ok: false, error: result.error, errorCode: result.errorCode };
        queuedJob.current = result.data?.pushJobId ?? null;
        return { ok: true };
      },
      success: "ATG settings saved",
      successDescription: () => toastSaved(queuedJob.current),
      onSuccess: () => {
        onSaved(queuedJob.current);
        router.refresh();
      },
    });
  }

  const description = (
    <>
      The auction type and distribution ATG gets for this sale. Platform, default category and bid
      increments come from LAX&apos;s ATG account setup.
      {view.settingsUpdatedAt ? (
        <>
          {" "}
          Last changed <StaffDate value={view.settingsUpdatedAt} withTime />.
        </>
      ) : null}
    </>
  );

  if (readOnly) {
    const stateHint = lockedReason ? fixedBecause(lockedReason) : null;
    const items: KeyValueItem[] = [
      {
        label: "Auction type",
        value: (
          <ReadOnlyValue
            value={optionLabel(AUCTION_TYPE_OPTIONS, view.settings.auctionType)}
            hint={typeLocked ? TYPE_FIXED : stateHint}
          />
        ),
      },
      {
        label: "Distribution",
        value: (
          <ReadOnlyValue
            value={optionLabel(DISTRIBUTION_OPTIONS, view.settings.distribution)}
            hint={distributionLocked ? DISTRIBUTION_FIXED : stateHint}
          />
        ),
      },
    ];
    return (
      <Section title="ATG settings" description={description}>
        <KeyValueList items={items} columns={2} />
      </Section>
    );
  }

  let typeField: ReactNode;
  if (typeLocked) {
    typeField = (
      <Field label="Auction type" description={TYPE_FIXED}>
        <TextInput readOnly value={optionLabel(AUCTION_TYPE_OPTIONS, auctionType)} />
      </Field>
    );
  } else {
    typeField = (
      <RadioChoices
        label="Auction type"
        description={TYPE_HINT}
        value={auctionType}
        options={AUCTION_TYPE_OPTIONS}
        disabled={choicesDisabled}
        onChange={setAuctionType}
      />
    );
  }

  let distributionField: ReactNode;
  if (distributionLocked) {
    distributionField = (
      <Field label="Distribution" description={DISTRIBUTION_FIXED}>
        <TextInput readOnly value={optionLabel(DISTRIBUTION_OPTIONS, distribution)} />
      </Field>
    );
  } else {
    distributionField = (
      <RadioChoices
        label="Distribution"
        description={DISTRIBUTION_HINT}
        value={distribution}
        options={DISTRIBUTION_OPTIONS}
        disabled={choicesDisabled}
        onChange={setDistribution}
      />
    );
  }

  return (
    <Section title="ATG settings" description={description}>
      <div className="flex flex-col gap-4">
        {failure ? (
          <Notice tone="danger" alert title="The settings were not saved">
            {failure}
          </Notice>
        ) : null}

        <FieldRow>
          {typeField}
          {distributionField}
        </FieldRow>

        {dirty ? (
          <FormActions
            start={<span className="text-staff-sm text-staff-muted">Unsaved changes</span>}
          >
            <StaffButton
              type="button"
              variant="primary"
              loading={pending}
              {...(busy ? { disabledReason: "Another ATG action is running" } : {})}
              onClick={goingPublic ? askPublic : save}
            >
              {view.linked ? "Save and send to ATG" : "Save changes"}
            </StaffButton>
          </FormActions>
        ) : null}
      </div>
      <UnsavedChangesGuard
        dirty={dirty}
        label="the ATG settings"
        navigate={router.push}
        interceptBack={false}
      />
      {confirm.dialog}
    </Section>
  );
}
