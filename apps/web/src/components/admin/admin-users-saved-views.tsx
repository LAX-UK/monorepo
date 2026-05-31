"use client";

import { buildListHref } from "@/lib/admin/admin-list-params";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { Input } from "@auction/ui/components/input";
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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [nextViewName, setNextViewName] = useState("");

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
    const name = nextViewName.trim();
    if (!name) return;
    const next: SavedView = {
      id: crypto.randomUUID(),
      name,
      query: currentQuery,
    };
    const updated = [...views.filter((v) => v.name !== next.name), next].slice(-12);
    setViews(updated);
    persistViews(updated);
    setNextViewName("");
    setSaveDialogOpen(false);
  }, [currentQuery, nextViewName, views]);

  const removeView = useCallback(
    (id: string) => {
      const updated = views.filter((v) => v.id !== id);
      setViews(updated);
      persistViews(updated);
    },
    [views],
  );

  return (
    <>
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
          <DropdownMenuItem
            onSelect={() => {
              setNextViewName("");
              setSaveDialogOpen(true);
            }}
          >
            Save current filters…
          </DropdownMenuItem>
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
                <Button
                  type="button"
                  variant="link"
                  size="link"
                  className="text-[10px] text-on-surface-variant underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeView(v.id);
                  }}
                >
                  Remove
                </Button>
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
      <ConfirmDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        title="Save current filters"
        body={
          <div className="space-y-2">
            <p>Enter a name for this view.</p>
            <Input
              autoFocus
              value={nextViewName}
              onChange={(event) => setNextViewName(event.target.value)}
              placeholder="e.g. Pending in UK"
              maxLength={60}
            />
          </div>
        }
        tone="info"
        confirmLabel="Save view"
        onConfirm={saveCurrent}
      />
    </>
  );
}
