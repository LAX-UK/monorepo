"use client";

import { useConsent } from "@/lib/analytics/consent/context";
import { trackLogin } from "@/lib/analytics/events";
import { useEffect, useRef } from "react";

function stripMagicLinkMarker(): void {
  const query = new URLSearchParams(window.location.search);
  if (!query.has("auth_method")) return;
  query.delete("auth_method");
  const encoded = query.toString();
  window.history.replaceState(
    null,
    "",
    encoded ? `${window.location.pathname}?${encoded}` : window.location.pathname,
  );
}

/** Track a verified magic-link landing once, without pre-consent browser storage. */
export function MagicLinkLoginSync() {
  const { snapshot } = useConsent();
  const markerCaptured = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    if (!markerCaptured.current) {
      markerCaptured.current =
        new URLSearchParams(window.location.search).get("auth_method") === "magic_link";
      if (markerCaptured.current) stripMagicLinkMarker();
    }
    if (!markerCaptured.current || completed.current) return;
    if (snapshot?.analytics !== true || snapshot.marketing !== true) return;
    completed.current = true;
    trackLogin("magic_link");
  }, [snapshot?.analytics, snapshot?.marketing]);

  return null;
}
