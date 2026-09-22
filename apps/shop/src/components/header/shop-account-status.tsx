"use client";

import { MarketingCircleAlertIcon, MarketingInfoIcon } from "@auction/marketing-ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import Link from "next/link";

type ShopAccountStatusProps = {
  kind: "disabled" | "unavailable";
  detailMessage: string;
  accountHref?: string;
  onNavigate?: () => void;
};

function StatusDetailTrigger({
  detailMessage,
  infoLabel,
}: {
  detailMessage: string;
  infoLabel: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="shop-header__account-status-info shop-focus-ring"
          aria-label={infoLabel}
        >
          <MarketingInfoIcon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-snug">{detailMessage}</TooltipContent>
    </Tooltip>
  );
}

export function ShopAccountStatus({
  kind,
  detailMessage,
  accountHref,
  onNavigate,
}: ShopAccountStatusProps) {
  const shortLabel = kind === "disabled" ? "Account restricted" : "Sign-in unavailable";
  const infoLabel =
    kind === "disabled" ? "Why this account is restricted" : "Why sign-in is unavailable";

  const statusBody = (
    <>
      <span className="shop-header__account-status-icon" aria-hidden>
        <MarketingCircleAlertIcon className="size-4" />
      </span>
      <span className="shop-header__account-status-label">{shortLabel}</span>
      <StatusDetailTrigger detailMessage={detailMessage} infoLabel={infoLabel} />
      <span className="sr-only">{detailMessage}</span>
    </>
  );

  if (kind === "disabled" && accountHref) {
    return (
      <Link
        href={accountHref}
        className="shop-header__account-status shop-focus-ring"
        {...(onNavigate ? { onClick: onNavigate } : {})}
      >
        {statusBody}
      </Link>
    );
  }

  return (
    <span className="shop-header__account-status shop-header__account-status--static">
      {statusBody}
    </span>
  );
}
