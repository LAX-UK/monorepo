"use client";

import { registerToaster } from "@/lib/ui/toast-bridge";
import { useEffect } from "react";

/** Rendered beside a toaster that is always mounted (the staff area's), so queued toasts show. */
export function ToasterPresence() {
  useEffect(() => registerToaster(), []);
  return null;
}
