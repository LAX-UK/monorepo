"use client";

import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { toggleSaleFollow } from "@/lib/data/http/sale-follow.client";
import type { CataloguePreparingVM } from "@/lib/marketing/saleroom/sale-page-state";
import { Button, ButtonLink, EmptyState } from "@auction/ui/lax";
import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

type Props = {
  copy: CataloguePreparingVM;
  saleId: string;
  /** Where signing in leads back to. */
  saleHref: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
};

function NotifyAction({
  saleId,
  saleHref,
  isAuthenticated,
  initialFollowing,
}: Omit<Props, "copy">) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const ok = await toggleSaleFollow(saleId, following);
      if (ok) setFollowing(!following);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [busy, following, saleId]);

  if (!isAuthenticated) {
    return (
      <ButtonLink
        variant="primary"
        className="@max-2xl:basis-full!"
        href={buildHostedLoginStartHref({ next: saleHref })}
        icon={<Bell aria-hidden />}
      >
        Get an email when lots are online
      </ButtonLink>
    );
  }

  return (
    <>
      <Button
        variant={following ? "secondary" : "primary"}
        className="@max-2xl:basis-full!"
        loading={busy}
        aria-pressed={following}
        icon={following ? <BellRing aria-hidden /> : <Bell aria-hidden />}
        onClick={() => void toggle()}
      >
        {following ? "We’ll email you when lots are online" : "Notify me when lots are online"}
      </Button>
      {failed ? (
        <p role="alert" className="w-full text-sm text-lax-danger-fg">
          That didn’t save. Try again in a moment.
        </p>
      ) : null}
    </>
  );
}

/**
 * A scheduled sale announced before its lots are online. It says when they will be, and offers the
 * two things a visitor can do now: hear when they appear, or consign a work to the sale.
 */
export function SaleroomCataloguePreparing({ copy, ...notify }: Props) {
  return (
    <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
      <EmptyState
        illustration="gavel"
        headingLevel="h3"
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <NotifyAction {...notify} />
            <ButtonLink
              Link={Link}
              variant="secondary"
              className="@max-2xl:basis-full!"
              href="/sell"
            >
              Consign a work
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
