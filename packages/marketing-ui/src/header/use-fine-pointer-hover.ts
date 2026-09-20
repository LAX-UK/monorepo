"use client";

import { useEffect, useState } from "react";

/** True when the primary input supports hover (desktop pointer). */
export function useFinePointerHover(): boolean {
  const [finePointerHover, setFinePointerHover] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFinePointerHover(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return finePointerHover;
}
