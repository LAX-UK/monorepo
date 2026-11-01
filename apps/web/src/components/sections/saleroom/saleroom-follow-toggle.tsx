"use client";

import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { toggleSaleFollow } from "@/lib/data/http/sale-follow.client";
import { Button, ButtonLink } from "@auction/ui/lax";
import { Bell, BellRing } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  saleId: string;
  initialFollowing: boolean;
  isAuthenticated: boolean;
  /** Where signing in leads back to. */
  loginNextPath: string;
  /** The action's words before it is on; once on, the button reads "Following". */
  label?: string;
};

/** Follow a sale to hear when it opens or closes: a secondary kit button, in the sale's action row. */
export function SaleroomFollowToggle({
  saleId,
  initialFollowing,
  isAuthenticated,
  loginNextPath,
  label = "Follow sale",
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await toggleSaleFollow(saleId, following);
      if (ok) setFollowing(!following);
    } finally {
      setBusy(false);
    }
  }, [busy, following, saleId]);

  if (!isAuthenticated) {
    return (
      <ButtonLink
        variant="secondary"
        href={buildHostedLoginStartHref({ next: loginNextPath })}
        icon={<BellRing aria-hidden />}
      >
        {label}
      </ButtonLink>
    );
  }

  return (
    <Button
      variant="secondary"
      loading={busy}
      aria-pressed={following}
      icon={following ? <BellRing aria-hidden /> : <Bell aria-hidden />}
      onClick={() => void toggle()}
    >
      {following ? "Following" : label}
    </Button>
  );
}
