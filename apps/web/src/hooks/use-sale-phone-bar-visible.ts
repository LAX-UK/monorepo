"use client";

import { useOutOfView } from "@/hooks/use-out-of-view";
import { SALE_HERO_ACTIONS_ID, shouldShowSalePhoneBar } from "@/lib/sale/sale-phone-bar-visibility";
import { useEffect, useRef, useState } from "react";

/** Room the bar takes at the bottom edge; the hero actions count as hidden under it. */
const BAR_STRIP_PX = 88;

/** Whether the sale's phone bar should show now, given the hero action row on the page. */
export function useSalePhoneBarVisible(): boolean {
  const target = useRef<Element | null>(null);
  const [present, setPresent] = useState<boolean | null>(null);
  useEffect(() => {
    target.current = document.getElementById(SALE_HERO_ACTIONS_ID);
    setPresent(target.current !== null);
  }, []);
  const outOfView = useOutOfView(target, BAR_STRIP_PX);
  return shouldShowSalePhoneBar({ heroActionsPresent: present, heroActionsOutOfView: outOfView });
}
