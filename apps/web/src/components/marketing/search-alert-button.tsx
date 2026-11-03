"use client";

import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { ensureSearchAlert } from "@/lib/marketing/search-alert";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { notify } from "@/lib/ui/notify";
import { Button, ButtonLink } from "@auction/ui/lax";
import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  isAuthenticated: boolean;
  q: string;
  categoryId?: string;
  /** The search page with `alert=1`: signing in returns here and the alert is saved on arrival. */
  returnHref: string;
  /** True when arriving from sign-in with the alert already asked for. */
  saveOnArrival: boolean;
  /** True when the account's saved searches already hold an alert for this search. */
  alertSet?: boolean;
  /** Where saved search alerts are managed. */
  manageHref?: string;
};

type Phase = "idle" | "saving" | "saved";

/** "Get an alert for this search": emails the visitor when a lot matching the text goes on sale. */
export function SearchAlertButton({
  isAuthenticated,
  q,
  categoryId,
  returnHref,
  saveOnArrival,
  alertSet = false,
  manageHref = CLIENT_ROUTES.watchingSearches,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>(alertSet ? "saved" : "idle");
  const asked = useRef(false);

  const save = useCallback(async () => {
    setPhase("saving");
    const outcome = await ensureSearchAlert(q, categoryId);
    if (outcome === "failed") {
      setPhase("idle");
      notify.error("Could not set the alert. Try again in a moment.");
      return;
    }
    setPhase("saved");
    notify.success(
      outcome === "existing"
        ? "You already have an alert for this search."
        : "Alert set. We’ll email you when a lot matches.",
    );
  }, [q, categoryId]);

  useEffect(() => {
    if (!saveOnArrival || !isAuthenticated || asked.current) return;
    asked.current = true;
    void save().finally(() => {
      const params = new URLSearchParams(window.location.search);
      params.delete("alert");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [saveOnArrival, isAuthenticated, save, router, pathname]);

  if (!isAuthenticated) {
    return (
      <ButtonLink
        variant="secondary"
        icon={<Bell aria-hidden />}
        href={buildHostedLoginStartHref({ next: returnHref })}
      >
        Get an alert for this search
      </ButtonLink>
    );
  }

  if (phase === "saved") {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
        <output className="inline-flex h-10 items-center gap-2 text-lax-14 font-medium text-lax-fg">
          <BellRing className="size-4" aria-hidden />
          Alert set
        </output>
        <ButtonLink Link={Link} variant="ghost" href={manageHref}>
          Manage alerts
        </ButtonLink>
      </span>
    );
  }

  return (
    <Button
      variant="secondary"
      icon={<Bell aria-hidden />}
      loading={phase === "saving"}
      onClick={() => void save()}
    >
      Get an alert for this search
    </Button>
  );
}
