"use client";

import {
  preloadToastLibrary,
  subscribeToastRequested,
  toastRequested,
} from "@/lib/ui/toast-bridge";
import { preloadToastWhenIdle } from "@/lib/ui/toast-preload";
import { type ComponentType, useEffect, useState, useSyncExternalStore } from "react";

type Host = ComponentType;

let loadedHost: Host | null = null;
let hostLoading: Promise<Host> | null = null;

/** Fetches the toast host once; later mounts of the gate reuse it. */
function loadHost(): Promise<Host> {
  hostLoading ??= import("@/components/ui/toaster-host").then((mod) => {
    loadedHost = mod.ToasterHost;
    return mod.ToasterHost;
  });
  return hostLoading;
}

/**
 * Global toast host. Nothing is on screen until a toast is raised, so the toast library and its
 * styles are not part of the page's first load: the first `notify` call (or a toast queued by
 * `runToast`) mounts the host, which then shows it. Once the page is idle the code is fetched
 * ahead (`preloadToastWhenIdle`), so that first toast is not slower. See `ToasterHost` for which toaster is used.
 *
 * The host is held in plain state rather than behind `next/dynamic`: the first toast is often
 * raised together with a router refresh, and a suspended lazy component could be dropped by it.
 */
export function Toaster() {
  const raised = useSyncExternalStore(subscribeToastRequested, toastRequested, () => false);
  const [Host, setHost] = useState<Host | null>(() => loadedHost);

  // Once the page is idle, fetch the host and the library so the first toast is not slower.
  useEffect(
    () =>
      preloadToastWhenIdle(() => {
        preloadToastLibrary();
        void loadHost();
      }),
    [],
  );

  useEffect(() => {
    if (!raised) return;
    let live = true;
    void loadHost().then((host) => {
      if (live) setHost(() => host);
    });
    return () => {
      live = false;
    };
  }, [raised]);

  return Host ? <Host /> : null;
}
