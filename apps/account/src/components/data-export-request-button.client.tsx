"use client";

import { LoadingButton } from "@/components/account-button";
import { requestDataExportAction } from "@/server/application/data-export-actions.server";
import { buildReauthHref } from "@/server/domain/account-reauth";
import { DATA_EXPORT_ROUTE, dataExportReturnTo } from "@/server/domain/data-export-routes";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type Notice = { tone: "error" | "info"; message: string };

const STEP_UP_FAILED =
  "We couldn't confirm it's you, so nothing was requested. Press Request your data to try again.";

/**
 * Asks for a copy. An old sign-in goes through the hosted re-sign-in and returns here with
 * `resume`, and the request then goes through without a second press. That return is tried once:
 * if Identity still wants a newer sign-in, the person is told rather than sent round again.
 */
export function RequestDataExportButton({
  label = "Request your data",
  resume = false,
}: {
  label?: string;
  /** This page was opened by the return from signing in again. */
  resume?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const started = useRef(false);

  function request(resumed: boolean) {
    setNotice(null);
    startTransition(async () => {
      const result = await requestDataExportAction();
      switch (result.status) {
        case "requested":
        case "already_open":
          // A navigation to the plain page, which also drops the return's `resume` query.
          router.replace(DATA_EXPORT_ROUTE);
          return;
        case "limited":
          window.history.replaceState(null, "", DATA_EXPORT_ROUTE);
          setNotice({ tone: "info", message: result.message });
          return;
        case "reauth_required":
          if (resumed) {
            window.history.replaceState(null, "", DATA_EXPORT_ROUTE);
            setNotice({ tone: "error", message: STEP_UP_FAILED });
            return;
          }
          window.location.assign(buildReauthHref(dataExportReturnTo("request")));
          return;
        case "error":
          setNotice({ tone: "error", message: result.message });
          return;
      }
    });
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, on return from signing in
  useEffect(() => {
    if (!resume || started.current) return;
    started.current = true;
    request(true);
  }, [resume]);

  return (
    <div className="flex flex-col gap-3">
      <LoadingButton
        type="button"
        variant="cta"
        loading={pending}
        loadingLabel="Requesting…"
        className="w-full min-h-11 sm:w-fit"
        onClick={() => request(false)}
      >
        {label}
      </LoadingButton>
      <div aria-live="polite">
        {notice ? (
          <p
            role={notice.tone === "error" ? "alert" : undefined}
            className={notice.tone === "error" ? "text-sm text-error" : "text-sm text-on-surface"}
          >
            {notice.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
