"use client";

import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import {
  acceptPrivateSaleTermsAction,
  startPrivateSalePaymentAction,
} from "@/lib/actions/private-sales";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { PartyDealDetail } from "@/lib/private-sales/party-deals.schema";
import { stageBadge, stageSentence } from "@/lib/private-sales/party-deals.vm";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/lax/button";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { Notice } from "@auction/ui/lax/notice";
import { StatusBadge } from "@auction/ui/lax/status-badge";
import { pageTitleClass } from "@auction/ui/lax/styles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const money = (minor: number) => formatMoney(minor / 100);

type Line = { label: string; value: string; strong?: boolean };

function moneyLines(detail: PartyDealDetail): Line[] | null {
  const { buyerMoney, sellerMoney } = detail.view;
  if (buyerMoney) {
    return [
      { label: "Price", value: money(buyerMoney.priceMinor) },
      ...(buyerMoney.buyerFeeMinor > 0
        ? [{ label: "Fee", value: money(buyerMoney.buyerFeeMinor) }]
        : []),
      { label: "Total due", value: money(buyerMoney.totalDueMinor), strong: true },
    ];
  }
  if (sellerMoney) {
    return [
      { label: "Agreed price", value: money(sellerMoney.priceMinor) },
      ...(sellerMoney.sellerCommissionMinor !== null
        ? [{ label: "Commission", value: `−${money(sellerMoney.sellerCommissionMinor)}` }]
        : []),
      ...(sellerMoney.costsMinor > 0
        ? [{ label: "Costs", value: `−${money(sellerMoney.costsMinor)}` }]
        : []),
      ...(sellerMoney.netToSellerMinor !== null
        ? [{ label: "You receive", value: money(sellerMoney.netToSellerMinor), strong: true }]
        : []),
    ];
  }
  return null;
}

/**
 * One private sale for the person who is a party to it. Before the price is agreed it says so and
 * shows no figure. Accepting the terms is the one action before agreement, and paying the one
 * action after the invoice. A check that is holding the deal up is shown as the step the person
 * takes, in plain words; nothing here says who the other side is unless the deal discloses them.
 */
export function PrivateSaleDetail({ detail }: { detail: PartyDealDetail }) {
  const router = useRouter();
  const { view } = detail;
  const role = view.audience;
  const badge = stageBadge(role, view.stage);
  const [busy, setBusy] = useState<"terms" | "pay" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lines = moneyLines(detail);
  const paymentDue = view.paymentDueAt ? formatDateTime(view.paymentDueAt) : null;

  async function accept() {
    setBusy("terms");
    setError(null);
    const result = await acceptPrivateSaleTermsAction(view.reference);
    setBusy(null);
    if (result.ok) {
      notify.success("Terms accepted");
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function pay() {
    setBusy("pay");
    setError(null);
    const result = await startPrivateSalePaymentAction(view.reference);
    if (result.ok && result.data) {
      window.location.assign(result.data.checkoutUrl);
      return;
    }
    setBusy(null);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1 className={pageTitleClass} data-page-title="">
            {detail.work.title}
          </h1>
          <p className="mt-1 text-lax-14 text-lax-muted">
            Private sale · {view.reference} · {detail.work.reference}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <StatusBadge tone={badge.tone} shape={badge.shape}>
            {badge.label}
          </StatusBadge>
          {detail.termsToAccept ? (
            <Button variant="primary" loading={busy === "terms"} onClick={() => void accept()}>
              Accept the terms
            </Button>
          ) : null}
          {detail.payable ? (
            <Button variant="primary" loading={busy === "pay"} onClick={() => void pay()}>
              Pay{view.buyerMoney ? ` ${money(view.buyerMoney.totalDueMinor)}` : ""}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Notice tone="danger" alert title="That didn't go through">
          {error}
        </Notice>
      ) : null}

      {detail.needs === "verify_identity" ? (
        <Notice
          tone="info"
          title="Verify your identity"
          actions={
            <ButtonLink href={CLIENT_ROUTES.verifyIdentity} Link={Link} variant="secondary">
              Verify your identity
            </ButtonLink>
          }
        >
          We need to verify who you are before this private sale can go ahead.
        </Notice>
      ) : null}
      {detail.needs === "proof_of_funds" ? (
        <Notice
          tone="info"
          title="We need proof of funds"
          actions={
            <ButtonLink href={CLIENT_ROUTES.sourceOfFunds} Link={Link} variant="secondary">
              Add proof of funds
            </ButtonLink>
          }
        >
          For a purchase of this size we ask where the money comes from. It takes a few minutes.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <WorkspacePanel title="Where it stands">
          <p className="m-0 text-lax-14 text-lax-fg">
            {stageSentence(role, view.stage, paymentDue)}
          </p>
          {detail.termsToAccept ? (
            <p className="mt-3 mb-0 text-lax-13 text-lax-muted">
              Accepting records that you agree to the{" "}
              <Link href="/terms" className="underline underline-offset-4">
                private sale terms
              </Link>{" "}
              (version {detail.termsToAccept}). You are asked once for each private sale.
            </p>
          ) : null}
          <dl className="mt-4 flex flex-col gap-2 text-lax-14">
            <div className="flex justify-between gap-4">
              <dt className="text-lax-muted">{role === "buyer" ? "Sold by" : "Sold to"}</dt>
              <dd className="text-right text-lax-fg">{view.counterparty.label}</dd>
            </div>
            {view.collectionDueAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-lax-muted">Collect by</dt>
                <dd className="text-right tabular-nums text-lax-fg">
                  {formatDateTime(view.collectionDueAt)}
                </dd>
              </div>
            ) : null}
          </dl>
        </WorkspacePanel>
        <WorkspacePanel title={role === "buyer" ? "Payment" : "Your proceeds"}>
          {lines ? (
            <dl className="flex flex-col gap-2 text-lax-14">
              {lines.map((line) => (
                <div
                  key={line.label}
                  className={
                    line.strong
                      ? "mt-2 flex justify-between gap-4 border-t border-lax-line pt-3 font-semibold"
                      : "flex justify-between gap-4"
                  }
                >
                  <dt className={line.strong ? "text-lax-fg" : "text-lax-muted"}>{line.label}</dt>
                  <dd className="text-right tabular-nums text-lax-fg">{line.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="m-0 text-lax-14 text-lax-muted">Offer under discussion.</p>
          )}
          {role === "buyer" && view.stage === "invoiced" && paymentDue ? (
            <p className="mt-3 mb-0 text-lax-13 text-lax-muted">Pay by {paymentDue}.</p>
          ) : null}
        </WorkspacePanel>
      </div>
    </div>
  );
}
