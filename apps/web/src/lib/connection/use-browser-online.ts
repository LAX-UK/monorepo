"use client";

import { getBrowserConnectivityPort } from "@/lib/connection/browser-connectivity";
import { useEffect, useState } from "react";

export function useBrowserOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const port = getBrowserConnectivityPort();
    setOnline(port.isOnline());
    return port.subscribe(setOnline);
  }, []);

  return online;
}
