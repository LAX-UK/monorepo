"use client";

import { AccountTile } from "@/components/layout/account-switcher/account-tile";
import { initials } from "@/components/organisations/initials";
import { setOrganisationMuted } from "@/lib/services/client/notifications-inbox.client";
import { notify } from "@/lib/ui/notify";
import type { NotificationAccountMute } from "@auction/types";
import { Button } from "@auction/ui/lax";
import { useState } from "react";

/**
 * The organisations the person asked not to be notified about, each with a way to hear about it
 * again. Muting happens from a notification's menu; notices that carry money, a decision or
 * security always arrive anyway.
 */
export function MutedOrganisations({ initial }: { initial: readonly NotificationAccountMute[] }) {
  const [muted, setMuted] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const unmute = async (mute: NotificationAccountMute) => {
    setBusy(mute.legalEntityId);
    const result = await setOrganisationMuted(mute.legalEntityId, false);
    setBusy(null);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
    setMuted((current) => current.filter((m) => m.legalEntityId !== mute.legalEntityId));
    notify.success(`You'll be notified about ${mute.displayName} again`);
  };

  return (
    <div>
      <p className="text-lax-14 font-semibold text-lax-fg">Muted organisations</p>
      {muted.length === 0 ? (
        <p className="mt-1 text-lax-13 text-lax-muted">
          None. To mute one, choose &ldquo;Don&apos;t notify me about&rdquo; in a
          notification&apos;s menu. Payments, wins and requests that need you still reach you.
        </p>
      ) : (
        <>
          <p className="mt-1 text-lax-13 text-lax-muted">
            Payments, wins and requests that need you still reach you.
          </p>
          <ul className="mt-3 divide-y divide-lax-line-subtle overflow-hidden rounded-lax-card border border-lax-line bg-lax-surface">
            {muted.map((mute) => (
              <li key={mute.legalEntityId} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <AccountTile
                  account={{ kind: "organisation", initials: initials(mute.displayName) }}
                  size="xs"
                />
                <span className="min-w-0 flex-1 truncate text-lax-14 font-medium text-lax-fg">
                  {mute.displayName}
                </span>
                <Button
                  size="sm"
                  loading={busy === mute.legalEntityId}
                  onClick={() => void unmute(mute)}
                >
                  Notify me again
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
