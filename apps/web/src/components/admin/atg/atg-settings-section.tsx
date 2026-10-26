"use client";

import { adminAtgSaleSettingsAction } from "@/lib/actions/admin-atg";
import { formatDateTime } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import {
  ATG_AUCTION_TYPES,
  ATG_DISTRIBUTIONS,
  type AtgAuctionType,
  type AtgDistribution,
  type AtgSaleSyncView,
  canChangeAtgAuctionType,
  canChangeAtgDistribution,
} from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const AUCTION_TYPE_LABEL: Record<AtgAuctionType, string> = {
  Timed: "Timed",
  Live: "Live",
};

const DISTRIBUTION_LABEL: Record<AtgDistribution, string> = {
  private_test: "Private test (hidden from public listings)",
  public_marketplace: "Public: White Label and The Saleroom",
};

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

export function AtgSettingsSection({
  saleId,
  view,
  canManage,
  disabled,
  readiness,
  onSaved,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [auctionType, setAuctionType] = useState(view.settings.auctionType);
  const [distribution, setDistribution] = useState(view.settings.distribution);
  const [confirmingPublic, setConfirmingPublic] = useState(false);

  const typeLocked = !canChangeAtgAuctionType(view);
  const distributionLocked = !canChangeAtgDistribution(view);
  const readOnly = !canManage || disabled;
  const dirty =
    auctionType !== view.settings.auctionType || distribution !== view.settings.distribution;
  const goingPublic =
    distribution === "public_marketplace" && view.settings.distribution !== "public_marketplace";

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

  return (
    <section aria-labelledby="atg-settings-heading" className="space-y-4">
      <div className="space-y-1">
        <h3 id="atg-settings-heading" className="font-medium text-on-surface">
          ATG settings
        </h3>
        <p className="text-sm text-on-surface-variant">
          Platform, default category and bid increments come from LAX&apos;s ATG account setup and
          apply to every sale.
          {view.settingsUpdatedAt ? ` Last changed ${formatDateTime(view.settingsUpdatedAt)}.` : ""}
        </p>
      </div>

      {readiness.length > 0 ? (
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
          <p className="font-medium text-sm text-on-surface">Not ready to publish on ATG</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
            {readiness.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="atg-auction-type">Auction type</Label>
          <Select
            value={auctionType}
            onValueChange={(value) => setAuctionType(value as AtgAuctionType)}
            disabled={readOnly || typeLocked || pending}
          >
            <SelectTrigger id="atg-auction-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATG_AUCTION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {AUCTION_TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-on-surface-variant">
            {typeLocked
              ? "Fixed: ATG already has this auction."
              : "ATG accepts Timed or Live auctions."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="atg-distribution">Distribution</Label>
          <Select
            value={distribution}
            onValueChange={(value) => setDistribution(value as AtgDistribution)}
            disabled={readOnly || distributionLocked || pending}
          >
            <SelectTrigger id="atg-distribution">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATG_DISTRIBUTIONS.map((value) => (
                <SelectItem key={value} value={value}>
                  {DISTRIBUTION_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-on-surface-variant">
            {distributionLocked
              ? "Fixed: the auction is already published on ATG."
              : "Public auctions appear on both the White Label and The Saleroom."}
          </p>
        </div>
      </div>

      {canManage ? (
        <Button
          type="button"
          variant="secondary"
          disabled={!dirty || pending || disabled}
          onClick={() => (goingPublic ? setConfirmingPublic(true) : save(false))}
        >
          Save ATG settings
        </Button>
      ) : null}

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
