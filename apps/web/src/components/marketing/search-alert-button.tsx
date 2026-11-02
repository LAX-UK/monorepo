"use client";

import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { createSavedSearch } from "@/lib/data/http/saved-searches.client";
import { searchAlertLabel, searchAlertQuery } from "@/lib/marketing/search-fallback";
import { notify } from "@/lib/ui/notify";
import { Button, ButtonLink } from "@auction/ui/lax";
import { Bell, BellRing } from "lucide-react";
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
};

type Phase = "idle" | "saving" | "saved";

/** "Get an alert for this search": emails the visitor when a lot matching the text goes on sale. */
export function SearchAlertButton({
  isAuthenticated,
  q,
  categoryId,
  returnHref,
  saveOnArrival,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const asked = useRef(false);

  const save = useCallback(async () => {
    setPhase("saving");
    const result = await createSavedSearch({
      label: searchAlertLabel(q),
      query: searchAlertQuery(q, categoryId),
      notifyEmail: true,
    });
    if (!result.ok) {
      setPhase("idle");
      notify.error("Could not set the alert. Try again in a moment.");
      return;
    }
    setPhase("saved");
    notify.success("Alert set. We’ll email you when a lot matches.");
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
      <Button variant="secondary" icon={<BellRing aria-hidden />} disabled>
        Alert set
      </Button>
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
