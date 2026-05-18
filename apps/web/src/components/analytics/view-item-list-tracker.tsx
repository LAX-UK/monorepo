"use client";

import { trackViewItemList } from "@/lib/analytics/events";
import { useEffect, useRef } from "react";

export function ViewItemListTracker({
  listId,
  listName,
  itemIds,
}: {
  listId: string;
  listName: string;
  itemIds: string[];
}) {
  const fired = useRef<string | null>(null);

  useEffect(() => {
    if (itemIds.length === 0) return;
    const key = `${listId}:${itemIds.join(",")}`;
    if (fired.current === key) return;
    fired.current = key;
    trackViewItemList({ listId, listName, itemIds });
  }, [listId, listName, itemIds]);

  return null;
}
