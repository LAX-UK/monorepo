"use client";

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

import { AdminListAlert } from "@/components/admin/admin-list-alert";
import {
  checkInOnsiteEventGuest,
  fetchOnsiteEventCheckInStats,
  searchOnsiteEventGuests,
  setOnsiteEventCheckInDryRun,
} from "@/lib/data/http/onsite-event-check-in.client";
import { formatDateTime } from "@/lib/ui/format";
import type { OnsiteEventCheckInResult, OnsiteEventCheckInSearchRow } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { ConfirmDialog } from "@auction/ui/components/confirm-dialog";
import { Input } from "@auction/ui/components/input";
import { Surface } from "@auction/ui/components/surface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkInInputKey,
  shouldDebounceSuccessfulScan,
  shouldSuppressRepeatScan,
} from "./check-in-scan-debounce";

type Props = {
  slug: string;
  title: string;
};

function resultTone(status: OnsiteEventCheckInResult["status"]): string {
  switch (status) {
    case "VALID":
    case "DRY_RUN_VALID":
      return "border-emerald-500 bg-emerald-50 text-emerald-950";
    case "ALREADY_CHECKED_IN":
      return "border-amber-500 bg-amber-50 text-amber-950";
    default:
      return "border-red-500 bg-red-50 text-red-950";
  }
}

function resultTitle(result: OnsiteEventCheckInResult): string {
  switch (result.status) {
    case "VALID":
      return "Admit — checked in";
    case "DRY_RUN_VALID":
      return "Admit — dry run (not recorded)";
    case "ALREADY_CHECKED_IN":
      return "Already checked in";
    case "INVALID":
      return "Pass not recognised";
    case "WRONG_EVENT":
      return "Wrong event";
    case "EVENT_CLOSED":
      return "Check-in closed";
  }
}

export function OnsiteEventCheckInConsole({ slug, title }: Props) {
  const [activeTab, setActiveTab] = useState("scan");
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, checkInDryRun: false });
  const [statsError, setStatsError] = useState<string | null>(null);
  const [dryRunBusy, setDryRunBusy] = useState(false);
  const [dryRunError, setDryRunError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OnsiteEventCheckInSearchRow[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [result, setResult] = useState<OnsiteEventCheckInResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dryRunConfirmOpen, setDryRunConfirmOpen] = useState(false);
  const busyRef = useRef(false);
  const searchGenerationRef = useRef(0);
  const lastScanKeyRef = useRef<string | null>(null);
  const lastScanAtRef = useRef(0);
  const lastScanStatusRef = useRef<OnsiteEventCheckInResult["status"] | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const runCheckInRef = useRef<(input: { token?: string; rsvpId?: string }) => Promise<void>>(
    async () => undefined,
  );

  const refreshStats = useCallback(async () => {
    try {
      const next = await fetchOnsiteEventCheckInStats(slug);
      setStats(next);
      setStatsError(null);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : "Could not load arrival stats");
    }
  }, [slug]);

  const runCheckIn = useCallback(
    async (input: { token?: string; rsvpId?: string }) => {
      if (busyRef.current) return;

      const inputKey = checkInInputKey(input);
      if (
        shouldSuppressRepeatScan({
          inputKey,
          lastKey: lastScanKeyRef.current,
          lastAt: lastScanAtRef.current,
          lastStatus: lastScanStatusRef.current,
        })
      ) {
        return;
      }

      busyRef.current = true;
      setBusy(true);
      setNetworkError(null);
      setResult(null);
      try {
        const next = await checkInOnsiteEventGuest(slug, input);
        setResult(next);
        if (inputKey) {
          lastScanKeyRef.current = inputKey;
          lastScanAtRef.current = Date.now();
          lastScanStatusRef.current = shouldDebounceSuccessfulScan(next.status)
            ? next.status
            : next.status === "INVALID" || next.status === "WRONG_EVENT"
              ? next.status
              : null;
        }
        if (next.status === "VALID" || next.status === "DRY_RUN_VALID") {
          setManualToken("");
          await refreshStats();
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Check-in failed";
        setNetworkError(
          message.includes("401")
            ? "Your session may have expired. Sign in again and return to this page."
            : message,
        );
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [refreshStats, slug],
  );

  runCheckInRef.current = runCheckIn;

  useEffect(() => {
    void refreshStats();
    const timer = window.setInterval(() => {
      void refreshStats();
    }, 45_000);
    return () => window.clearInterval(timer);
  }, [refreshStats]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const generation = ++searchGenerationRef.current;
    const handle = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchOnsiteEventGuests(slug, searchQuery.trim())
        .then((rows) => {
          if (generation !== searchGenerationRef.current) return;
          setSearchResults(rows);
        })
        .catch((e) => {
          if (generation !== searchGenerationRef.current) return;
          setSearchResults([]);
          setSearchError(e instanceof Error ? e.message : "Search failed");
        })
        .finally(() => {
          if (generation === searchGenerationRef.current) setSearching(false);
        });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchQuery, slug]);

  useEffect(() => {
    function stopScanner() {
      if (scanTimerRef.current != null) window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    }

    if (activeTab !== "scan") {
      stopScanner();
      return;
    }

    let cancelled = false;
    async function startScanner() {
      const video = videoRef.current;
      if (!video) return;

      if ("BarcodeDetector" in window) {
        setCameraSupported(true);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false,
          });
          if (cancelled) {
            for (const track of stream.getTracks()) track.stop();
            return;
          }
          streamRef.current = stream;
          video.srcObject = stream;
          await video.play();
          const Detector = window.BarcodeDetector;
          if (!Detector) return;
          const detector = new Detector({ formats: ["qr_code"] });
          scanTimerRef.current = window.setInterval(() => {
            const el = videoRef.current;
            if (!el || el.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || busyRef.current)
              return;
            void detector
              .detect(el)
              .then((codes) => {
                const raw = codes[0]?.rawValue?.trim();
                if (raw) void runCheckInRef.current({ token: raw });
              })
              .catch(() => undefined);
          }, 500);
        } catch {
          setCameraSupported(false);
        }
        return;
      }

      setCameraSupported(true);
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          (result) => {
            if (!result || busyRef.current) return;
            void runCheckInRef.current({ token: result.getText() });
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        zxingControlsRef.current = controls;
      } catch {
        setCameraSupported(false);
      }
    }
    void startScanner();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
            {title}
          </h1>
          <p className="font-body text-sm text-on-surface-variant">
            {stats.checkedIn} / {stats.total} arrived
            {stats.checkInDryRun ? " · Dry-run mode on" : ""}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={stats.checkInDryRun ? "default" : "outline"}
          disabled={dryRunBusy}
          aria-pressed={stats.checkInDryRun}
          aria-describedby="check-in-dry-run-hint"
          onClick={() => {
            if (stats.checkInDryRun) {
              setDryRunConfirmOpen(true);
              return;
            }
            setDryRunBusy(true);
            setDryRunError(null);
            void setOnsiteEventCheckInDryRun(slug, true)
              .then((enabled) => setStats((prev) => ({ ...prev, checkInDryRun: enabled })))
              .catch((e) => {
                setDryRunError(e instanceof Error ? e.message : "Could not update dry-run mode");
              })
              .finally(() => setDryRunBusy(false));
          }}
        >
          {dryRunBusy ? "Updating…" : stats.checkInDryRun ? "Dry-run on" : "Dry-run off"}
        </Button>
      </div>

      <p id="check-in-dry-run-hint" className="sr-only">
        Dry-run mode validates passes without recording arrivals. Turn off when the door opens for
        live check-in.
      </p>

      {stats.checkInDryRun ? (
        <Surface className="border border-amber-500/50 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-950/30">
          <output
            aria-live="polite"
            className="block font-body text-sm font-medium text-amber-950 dark:text-amber-100"
          >
            Dry-run mode is on — scans are validated but not recorded. Turn off before admitting
            guests for real.
          </output>
        </Surface>
      ) : null}

      {statsError ? (
        <AdminListAlert title="Could not refresh arrival stats" variant="default">
          {statsError}
        </AdminListAlert>
      ) : null}

      {dryRunError ? <AdminListAlert>{dryRunError}</AdminListAlert> : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scan">Scan QR</TabsTrigger>
          <TabsTrigger value="search">Search name</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          <Surface className="overflow-hidden p-0">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full bg-black object-cover"
              muted
              playsInline
              aria-label="QR code scanner camera preview"
            />
          </Surface>
          {cameraSupported === null ? (
            <p className="font-body text-sm text-on-surface-variant">Starting camera…</p>
          ) : null}
          {cameraSupported === false ? (
            <output aria-live="polite" className="block font-body text-sm text-on-surface-variant">
              Camera scanning is unavailable on this device. Paste the pass link or token below, or
              use Search name.
            </output>
          ) : null}
          <div className="space-y-2">
            <label className="font-body text-sm text-on-surface-variant" htmlFor="manual-token">
              Or paste pass link / token
            </label>
            <Input
              id="manual-token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualToken.trim() && !busy) {
                  void runCheckIn({ token: manualToken.trim() });
                }
              }}
              placeholder="https://event.lax.bid/pass/…"
            />
            <Button
              type="button"
              className="w-full min-h-11"
              disabled={!manualToken.trim() || busy}
              onClick={() => void runCheckIn({ token: manualToken.trim() })}
            >
              {busy ? "Checking in…" : "Check in"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search guests"
          />
          <div className="space-y-2">
            {searching ? (
              <p className="font-body text-sm text-on-surface-variant">Searching…</p>
            ) : null}
            {searchError ? (
              <p className="font-body text-sm text-destructive">{searchError}</p>
            ) : null}
            {!searching &&
            !searchError &&
            searchQuery.trim().length >= 2 &&
            searchResults.length === 0 ? (
              <p className="font-body text-sm text-on-surface-variant">
                No guests match “{searchQuery.trim()}”.
              </p>
            ) : null}
            {searchResults.map((row) => (
              <Button
                key={row.rsvpId}
                type="button"
                variant="outline"
                className="flex h-auto w-full min-h-11 flex-col items-start rounded-lg px-4 py-3 text-left"
                disabled={busy}
                aria-label={`Check in ${row.name}`}
                onClick={() => void runCheckIn({ rsvpId: row.rsvpId })}
              >
                <span className="font-medium">{row.name}</span>
                <span className="font-body text-xs text-on-surface-variant">
                  {row.email} · {row.attendanceSegmentLabel}
                  {row.checkedInAt ? ` · Checked in ${formatDateTime(row.checkedInAt)}` : ""}
                </span>
              </Button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {busy ? (
        <p className="font-body text-sm text-on-surface-variant" aria-live="polite">
          Checking in…
        </p>
      ) : null}

      {networkError ? (
        <AdminListAlert title="Could not reach the server">
          {networkError}
          <span className="mt-2 block">
            Try again or use Search name to admit the guest manually.
          </span>
        </AdminListAlert>
      ) : null}

      {result ? (
        <output
          aria-live="assertive"
          className={`block rounded-xl border-2 p-5 ${resultTone(result.status)}`}
        >
          <p className="font-display text-xl">{resultTitle(result)}</p>
          {"guest" in result ? (
            <div className="mt-3 space-y-1 font-body text-sm">
              <p className="text-lg font-medium">{result.guest.name}</p>
              <p>{result.guest.attendanceSegmentLabel}</p>
              <p>
                Party of {result.guest.partySize}
                {result.guest.plusOneGuestName ? ` — ${result.guest.plusOneGuestName}` : ""}
              </p>
              {result.guest.checkedInAt ? (
                <p>
                  Checked in {formatDateTime(result.guest.checkedInAt)}
                  {result.guest.checkedInByName ? ` by ${result.guest.checkedInByName}` : ""}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 font-body text-sm">
              Try manual search or ask the guest to open their pass link.
            </p>
          )}
        </output>
      ) : null}

      <ConfirmDialog
        open={dryRunConfirmOpen}
        onOpenChange={setDryRunConfirmOpen}
        title="Go live with check-in?"
        body={
          <p>
            Turning off dry-run will record real arrivals. Only continue when you are ready to admit
            guests at the door.
          </p>
        }
        confirmLabel="Go live"
        tone="danger"
        loading={dryRunBusy}
        onConfirm={() => {
          setDryRunBusy(true);
          setDryRunError(null);
          void setOnsiteEventCheckInDryRun(slug, false)
            .then((enabled) => setStats((prev) => ({ ...prev, checkInDryRun: enabled })))
            .catch((e) => {
              setDryRunError(e instanceof Error ? e.message : "Could not update dry-run mode");
            })
            .finally(() => {
              setDryRunBusy(false);
              setDryRunConfirmOpen(false);
            });
        }}
      />
    </div>
  );
}
