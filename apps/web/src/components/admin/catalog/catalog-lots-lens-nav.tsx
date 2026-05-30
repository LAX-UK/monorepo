"use client";

import {
  type CatalogSegmentItem,
  CatalogSegmentNav,
  type CatalogSegmentNavProps,
} from "@/components/admin/catalog/catalog-segment-nav";
import { useEffect, useMemo, useState } from "react";

export const ADMIN_LOTS_VIEW_STORAGE_KEY = "admin-lots-view";

function appendPipelineView(href: string): string {
  try {
    const url = new URL(href, window.location.origin);
    url.searchParams.set("view", "pipeline");
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

/** Lens nav that keeps pipeline view when staff toggled pipeline mode (sessionStorage). */
export function CatalogLotsLensNav(props: CatalogSegmentNavProps) {
  const [preferPipeline, setPreferPipeline] = useState(false);

  useEffect(() => {
    try {
      setPreferPipeline(sessionStorage.getItem(ADMIN_LOTS_VIEW_STORAGE_KEY) === "pipeline");
    } catch {
      setPreferPipeline(false);
    }
  }, []);

  const items: readonly CatalogSegmentItem[] = useMemo(() => {
    if (!preferPipeline) return props.items;
    return props.items.map((item) => ({
      ...item,
      href: appendPipelineView(item.href),
    }));
  }, [preferPipeline, props.items]);

  return <CatalogSegmentNav {...props} items={items} />;
}
