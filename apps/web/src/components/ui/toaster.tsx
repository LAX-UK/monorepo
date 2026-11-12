"use client";

import { subscribeToastRequested, toastRequested } from "@/lib/ui/toast-bridge";
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

const ToasterHost = dynamic(
  () => import("@/components/ui/toaster-host").then((mod) => ({ default: mod.ToasterHost })),
  { ssr: false },
);

/**
 * Global toast host. Nothing is on screen until a toast is raised, so the toast library and its
 * styles are not part of the page's first load: the first `notify` call (or a toast queued by
 * `runToast`) mounts the host, which then shows it. See `ToasterHost` for which toaster is used.
 */
export function Toaster() {
  const raised = useSyncExternalStore(subscribeToastRequested, toastRequested, () => false);
  return raised ? <ToasterHost /> : null;
}
