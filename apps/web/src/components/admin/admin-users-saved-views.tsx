"use client";

import { buildListHref } from "@/lib/admin/admin-list-params";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { Bookmark } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "admin.users.savedViews";

type SavedView = { id: string; name: string; query: string };

function loadViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedView[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistViews(views: SavedView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

type Props = {
  storageKey?: string;
};

export function AdminUsersSavedViews({ storageKey = STORAGE_KEY }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    if (storageKey !== STORAGE_KEY) {
      try {
        const raw = localStorage.getItem(storageKey);
        setViews(raw ? (JSON.parse(raw) as SavedView[]) : []);
      } catch {
        setViews([]);
      }
      return;
    }
    setViews(loadViews());
  }, [storageKey]);

  const currentQuery = searchParams.toString();

  const saveCurrent = useCallback(() => {
    const name = window.prompt("Name this view");
    if (!name?.trim()) return;
    const next: SavedView = {
      id: crypto.randomUUID(),
      name: name.trim(),
      query: currentQuery,
    };
    const updated = [...views.filter((v) => v.name !== next.name), next].slice(-12);
    setViews(updated);
    persistViews(updated);
  }, [currentQuery, views]);

  const removeView = useCallback(
    (id: string) => {
      const updated = views.filter((v) => v.id !== id);
      setViews(updated);
      persistViews(updated);
    },
    [views],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 gap-1.5 font-label text-xs"
          aria-label="Saved views"
        >
          <Bookmark className="size-4" aria-hidden />
          Views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[16rem]">
        <DropdownMenuItem onSelect={() => saveCurrent()}>Save current filters…</DropdownMenuItem>
        {views.length > 0 ? <DropdownMenuSeparator /> : null}
        {views.length === 0 ? (
          <DropdownMenuItem disabled>No saved views</DropdownMenuItem>
        ) : (
          views.map((v) => (
            <DropdownMenuItem
              key={v.id}
              className="flex flex-col items-start gap-0.5"
              onSelect={() => {
                const href = v.query ? `${pathname}?${v.query}` : pathname;
                router.push(href);
              }}
            >
              <span className="font-medium">{v.name}</span>
              <button
                type="button"
                className="text-[10px] text-on-surface-variant underline"
                onClick={(e) => {
                  e.stopPropagation();
                  removeView(v.id);
                }}
              >
                Remove
              </button>
            </DropdownMenuItem>
          ))
        )}
        {currentQuery ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                router.push(buildListHref(pathname, Object.fromEntries(searchParams), {}))
              }
            >
              Clear all filters
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
