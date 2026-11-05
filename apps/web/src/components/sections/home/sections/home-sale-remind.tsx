"use client";

import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import { fetchSaleFollowing } from "@/lib/data/http/sale-follow.client";
import { useEffect, useState } from "react";

type Props = { saleId: string; saleHref: string; signedIn: boolean };

/**
 * "Remind me" on a coming-up sale: the sale page's own follow control, so a reminder is the
 * same thing wherever it is set. The home page is cached for everyone, so whether this person
 * already follows is read in the browser; signed out, the control leads to sign in and back.
 */
export function HomeSaleRemind({ saleId, saleHref, signedIn }: Props) {
  const [following, setFollowing] = useState<boolean | null>(signedIn ? null : false);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    void fetchSaleFollowing(saleId, controller.signal).then((value) => {
      if (!controller.signal.aborted) setFollowing(value);
    });
    return () => controller.abort();
  }, [saleId, signedIn]);

  return (
    <SaleroomFollowToggle
      // Remount once the real state is known, so the toggle starts from it.
      key={String(following)}
      saleId={saleId}
      initialFollowing={following === true}
      isAuthenticated={signedIn}
      loginNextPath={saleHref}
      label="Remind me"
    />
  );
}
