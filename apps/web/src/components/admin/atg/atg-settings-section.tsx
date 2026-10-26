"use client";

import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { adminAtgSaleSettingsAction } from "@/lib/actions/admin-atg";
import { notify } from "@/lib/ui/notify";
import {
  type EnumOption,
  EnumSelect,
  Field,
  FieldRow,
  FormActions,
  Notice,
  Section,
  StaffButton,
  StaffDate,
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
import { useRef, useState, useTransition } from "react";

const AUCTION_TYPE_OPTIONS: EnumOption<AtgAuctionType>[] = [
  { value: "Timed", label: "Timed" },
  { value: "Live", label: "Live" },
];

const DISTRIBUTION_OPTIONS: EnumOption<AtgDistribution>[] = [
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

type Props = {
  saleId: string;
  view: AtgSaleSyncView;
  canManage: boolean;
  /** Another ATG action is running, or the sale can't go to ATG at all. */
  disabled: boolean;
  /** Known blockers from the sale view; push still checks images and premium. */
  readiness: string[];
  /** Called with the queued push job when a linked sale was re-pushed. */
  onSaved: (pushJobId: string | null) => void;
};

/** The auction type and distribution ATG gets for this sale, locked once ATG has the auction. */
export function AtgSettingsSection({
  saleId,
  view,
  canManage,
  disabled,
  readiness,
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
  const readOnly = !canManage || disabled;
  const dirty =
    auctionType !== view.settings.auctionType || distribution !== view.settings.distribution;
  const goingPublic =
    distribution === "public_marketplace" && view.settings.distribution !== "public_marketplace";

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
      onSuccess: () => {
        onSaved(queuedJob.current);
        router.refresh();
      },
    });
  }

  return (
    <Section
      title="ATG settings"
      description={
        <>
          Platform, default category and bid increments come from LAX&apos;s ATG account setup and
          apply to every sale.
          {view.settingsUpdatedAt ? (
            <>
              {" "}
              Last changed <StaffDate value={view.settingsUpdatedAt} withTime />.
            </>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {readiness.length > 0 ? (
          <Notice tone="warning" title="Not ready to publish on ATG">
            <ul className="list-disc pl-5">
              {readiness.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {failure ? (
          <Notice tone="danger" alert title="The settings were not saved">
            {failure}
          </Notice>
        ) : null}

        <FieldRow>
          <Field
            label="Auction type"
            description={
              typeLocked
                ? "Fixed: ATG already has this auction."
                : "ATG accepts Timed or Live auctions."
            }
          >
            <EnumSelect
              value={auctionType}
              onValueChange={setAuctionType}
              options={AUCTION_TYPE_OPTIONS}
              disabled={readOnly || typeLocked || pending}
            />
          </Field>
          <Field
            label="Distribution"
            description={
              distributionLocked
                ? "Fixed: the auction is already published on ATG."
                : "Public auctions appear on both the White Label and The Saleroom."
            }
          >
            <EnumSelect
              value={distribution}
              onValueChange={setDistribution}
              options={DISTRIBUTION_OPTIONS}
              disabled={readOnly || distributionLocked || pending}
            />
          </Field>
        </FieldRow>

        {canManage && dirty ? (
          <FormActions
            start={<span className="text-staff-sm text-staff-muted">Unsaved changes</span>}
          >
            <StaffButton
              type="button"
              variant="primary"
              loading={pending}
              {...(disabled ? { disabledReason: "Another ATG action is running" } : {})}
              onClick={goingPublic ? askPublic : save}
            >
              Save changes
            </StaffButton>
          </FormActions>
        ) : null}
      </div>
      <UnsavedChangesGuard
        dirty={canManage && dirty}
        label="the ATG settings"
        navigate={router.push}
        interceptBack={false}
      />
      {confirm.dialog}
    </Section>
  );
}
