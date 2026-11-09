"use client";

import { listPrintPartyNames } from "@/server/application/print-party-actions.server";
import { useEffect, useState } from "react";

export type PrintParties =
  | { status: "loading" }
  | { status: "ready"; names: readonly string[] }
  | { status: "failed" };

/**
 * The names staff pick "Printed by" and "Published by" from. Read when the card opens, so a name
 * just added in Settings is there; a failed read is reported, never shown as an empty list.
 */
export function usePrintParties(): PrintParties {
  const [parties, setParties] = useState<PrintParties>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    listPrintPartyNames()
      .then((names) => {
        if (!cancelled) setParties(names ? { status: "ready", names } : { status: "failed" });
      })
      .catch(() => {
        if (!cancelled) setParties({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return parties;
}
